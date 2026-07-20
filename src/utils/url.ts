// Chỉ cho phép các scheme an toàn khi đưa URL vào href/window.open,
// tránh javascript:/data:/vbscript: bị chèn qua URL media/file từ backend.
const SAFE_URL_SCHEMES = ['http:', 'https:', 'blob:', 'mailto:', 'tel:'];

export function sanitizeExternalUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim();

  // URL tương đối (không có scheme) luôn an toàn để mở.
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    return SAFE_URL_SCHEMES.includes(parsed.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}
