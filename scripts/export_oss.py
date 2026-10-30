#!/usr/bin/env python3
"""Copy the public part of this hub into a separate folder (the open-source repo) and check it for private terms.

  python3 scripts/export_oss.py ../motionmind-oss [--git-init]

Only the allow-list below is copied; projects, brands (except demo), registry, fonts and local config never leave.
The destination is refreshed in place (everything except .git and studio/node_modules is replaced). Afterwards every
text file is scanned for motionmind.config.json → private_terms; any hit makes the export fail.
"""
import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

FILES = [
    "AGENTS.md", "README.md", "LICENSE", "NOTICE.md", "CHANGELOG.md", "SECURITY.md", ".gitignore",
    ".github/workflows/ci.yml",
    "motionmind.config.example.json",
    "scripts/export_oss.py",
    "scripts/brand-capture/README.md", "shared/ui-fonts/README.md",
]
DIRS = ["studio", "shared/brands/demo", "shared/brands/motionmind", "docs"]


def skip(directory: str, names: list[str]) -> list[str]:
    """Never copy build output, caches, packed tarballs, or the README/LICENSE/NOTICE copies `npm pack` drops in studio/."""
    out = [n for n in names if n in {"node_modules", ".next", "dist", "__pycache__", ".DS_Store", "next-env.d.ts"} or n.endswith((".tsbuildinfo", ".tgz"))]
    if pathlib.Path(directory).resolve() == (ROOT / "studio").resolve():
        out += [n for n in names if n in {"README.md", "LICENSE", "NOTICE.md"}]
    return out


KEEP_IN_DEST = {".git"}


def refresh_dest(dest: pathlib.Path) -> None:
    if dest == ROOT or ROOT in dest.parents or dest in ROOT.parents:
        sys.exit(f"Tujuan '{dest}' tidak boleh berada di dalam hub atau menjadi induk hub.")
    if dest.exists():
        entries = [p for p in dest.iterdir() if p.name not in KEEP_IN_DEST]
        if entries and not (dest / "scripts" / "export_oss.py").is_file():
            sys.exit(f"'{dest}' tidak kosong dan bukan hasil ekspor sebelumnya; pilih folder lain.")
        modules = dest / "studio" / "node_modules"
        for p in entries:
            if p.name == "studio" and modules.is_dir():
                for q in p.iterdir():
                    if q.name != "node_modules":
                        shutil.rmtree(q) if q.is_dir() else q.unlink()
            else:
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    dest.mkdir(parents=True, exist_ok=True)


def copy_tree(dest: pathlib.Path) -> None:
    for rel in FILES:
        src = ROOT / rel
        if not src.is_file():
            sys.exit(f"File wajib tidak ada: {rel}")
        (dest / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest / rel)
    for rel in DIRS:
        shutil.copytree(ROOT / rel, dest / rel, ignore=skip, dirs_exist_ok=True)
    (dest / "projects").mkdir(exist_ok=True)
    (dest / "projects" / ".gitkeep").touch()


def scan(dest: pathlib.Path, terms: list[str]) -> list[str]:
    if not terms:
        return []
    pattern = re.compile("|".join(re.escape(t) for t in terms), re.IGNORECASE)
    hits = []
    for path in sorted(dest.rglob("*")):
        rel = path.relative_to(dest)
        if rel.parts[0] == ".git" or "node_modules" in rel.parts:
            continue
        if pattern.search(str(rel)):
            hits.append(f"{rel}: nama path")
        if not path.is_file():
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        for n, line in enumerate(text.splitlines(), 1):
            m = pattern.search(line)
            if m:
                hits.append(f"{rel}:{n}: '{m.group(0)}' → {line.strip()[:120]}")
    return hits


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("dest", help="folder repo open source, mis. ../motionmind-oss")
    ap.add_argument("--git-init", action="store_true", help="jalankan git init bila belum ada .git")
    args = ap.parse_args()

    dest = pathlib.Path(args.dest).expanduser().resolve()
    config = ROOT / "motionmind.config.json"
    terms = json.loads(config.read_text()).get("private_terms", []) if config.is_file() else []

    refresh_dest(dest)
    copy_tree(dest)
    hits = scan(dest, terms)
    if hits:
        print(f"Ekspor ke {dest} GAGAL cek kebocoran ({len(hits)} temuan, private_terms di motionmind.config.json):")
        print("\n".join(f"  {h}" for h in hits))
        sys.exit(1)
    if args.git_init and not (dest / ".git").exists():
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=dest, check=True)
    files = sum(1 for p in dest.rglob("*") if p.is_file() and ".git" not in p.relative_to(dest).parts and "node_modules" not in p.parts)
    print(f"Ekspor OK: {dest} · {files} file · {len(terms)} private_terms bersih.")


if __name__ == "__main__":
    main()
