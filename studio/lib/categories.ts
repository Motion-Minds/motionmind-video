// Output categories, derived from what a run folder contains (no node imports: shared by server and client).
export type Category = "video" | "gambar";

export const CATEGORIES: { id: Category; label: string; href: string; hint: string }[] = [
  { id: "video", label: "Video", href: "/video", hint: "Run dengan file .mp4" },
  { id: "gambar", label: "Gambar", href: "/gambar", hint: "Carousel, cover, thumbnail (.png/.jpg/.webp)" },
];

export const categoryLabel = (id: Category) => CATEGORIES.find((c) => c.id === id)!.label;
