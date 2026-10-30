"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/categories";
import { BrandMark } from "./BrandMark";

const ICONS: Record<string, React.ReactNode> = {
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  gambar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="9.5" r="1.8" />
      <path d="M3.5 17l5-5 4 4 2.5-2.5 5.5 5" />
    </>
  ),
  all: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  campaigns: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  compare: (
    <>
      <rect x="3" y="5" width="8" height="14" rx="2" />
      <rect x="13" y="5" width="8" height="14" rx="2" />
    </>
  ),
  docs: <path d="M5 4.5h9l5 5v10a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19.5v-13.5a1.5 1.5 0 0 1 1-1.5zM14 4.5v5h5M8 13h8M8 16.5h5" />,
  starter: <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export interface SidebarProps {
  counts: Record<Category | "all" | "campaigns", number>;
  /** Category per run page path (`/r/<brand>/<campaign>/<version>`), so a run highlights the category it belongs to. */
  runCategories: Record<string, Category>;
}

export function Sidebar({ counts, runCategories }: SidebarProps) {
  const pathname = usePathname();
  const runCategory = pathname.startsWith("/r/") ? (runCategories[decodeURI(pathname)] ?? null) : null;
  const section: string | null =
    runCategory ??
    (pathname === "/" || pathname.startsWith("/r/")
      ? "all"
      : pathname.startsWith("/campaigns") || pathname.startsWith("/c/")
        ? "campaigns"
        : (["video", "gambar", "compare", "docs", "new", "starter"].find((s) => pathname.startsWith(`/${s}`)) ?? null));

  const item = (id: string, href: string, label: string, count?: number) => (
    <Link key={id} href={href} className={`side-link ${section === id ? "active" : ""}`}>
      <Icon name={id} />
      <span>{label}</span>
      {count != null && <span className="side-count">{count}</span>}
    </Link>
  );

  return (
    <aside className="sidebar">
      <Link href="/" className="lockup">
        <BrandMark className="lockup-mark" size={40} />
        <span>
          <span className="lockup-title">
            Motion<b>Mind</b>
          </span>
          <br />
          <span className="lockup-sub">Studio · video run tracking</span>
        </span>
      </Link>

      <Link href="/new" className={`btn primary side-cta ${section === "new" ? "active" : ""}`}>
        + Versi baru
      </Link>

      <nav className="side-nav">
        <div className="side-group">
          <span className="side-label">Kategori</span>
          {CATEGORIES.map((c) => item(c.id, c.href, c.label, counts[c.id]))}
        </div>
        <div className="side-group">
          <span className="side-label">Workspace</span>
          {item("starter", "/starter", "Starter kit")}
          {item("all", "/", "Semua run", counts.all)}
          {item("campaigns", "/campaigns", "Campaigns", counts.campaigns)}
          {item("compare", "/compare", "Compare video")}
        </div>
        <div className="side-group">
          <span className="side-label">Referensi</span>
          {item("docs", "/docs", "Dokumentasi")}
        </div>
      </nav>
    </aside>
  );
}
