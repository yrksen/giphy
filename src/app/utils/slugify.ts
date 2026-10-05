// Convert movie title and year to URL-friendly slug
export function createSlug(title: string, year?: number): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();

  // Add year to make slug unique
  return year ? `${titleSlug}-${year}` : titleSlug;
}

// Decode slug back to search for movie (not exact reverse, used for finding)
export function decodeSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .toLowerCase();
}
