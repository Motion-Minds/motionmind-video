// Output categories, derived from what a run folder contains (no node imports: shared by server and client).
export type Category = "video" | "image";

export const CATEGORIES: { id: Category; label: string; href: string; hint: string }[] = [
  { id: "video", label: "Video", href: "/video", hint: "Runs with an .mp4 file" },
  { id: "image", label: "Images", href: "/images", hint: "Carousels, covers, thumbnails (.png/.jpg/.webp)" },
];

export const categoryLabel = (id: Category) => CATEGORIES.find((c) => c.id === id)!.label;
