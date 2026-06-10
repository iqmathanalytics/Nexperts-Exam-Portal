const MAX_IDENTITY_PHOTO_CHARS = 3_000_000;

export function normalizeIdentityPhoto(input: string): string | null {
  const trimmed = input.trim();
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmed)) return null;
  if (trimmed.length > MAX_IDENTITY_PHOTO_CHARS) return null;
  return trimmed;
}
