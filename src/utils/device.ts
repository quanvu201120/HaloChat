export type DeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'tv' | 'unknown';

const DEVICE_PATTERNS: Array<{ category: DeviceCategory; test: RegExp }> = [
  {
    category: 'mobile',
    test: /(iphone|ios|android|android.*mobile|android.*phone|mobile|handset|phone)/,
  },
  {
    category: 'tablet',
    test: /(ipad|tablet)/,
  },
  {
    category: 'tv',
    test: /(tv|smart tv|android tv|apple tv|fire tv|webos)/,
  },
  {
    category: 'desktop',
    test: /(windows|mac|macos|os x|linux|chrome os|desktop|pc|laptop|notebook)/,
  },
];

const DESKTOP_BROWSER_PATTERNS: Array<[RegExp, string]> = [
  [/\bedg\//, 'Edge'],
  [/\bopr\//, 'Opera'],
  [/\bopera\//, 'Opera'],
  [/\bfirefox\//, 'Firefox'],
  [/\bchrome\//, 'Chrome'],
  [/\bsafari\//, 'Safari'],
];

const PLATFORM_PATTERNS: Array<[RegExp, string]> = [
  [/\bwindows\b/, 'Windows'],
  [/\bmac os\b|\bmacintosh\b|\bmacos\b/, 'macOS'],
  [/\bandroid\b/, 'Android'],
  [/\biphone\b|\bipad\b|\bios\b/, 'iOS'],
  [/\blinux\b/, 'Linux'],
];

export function normalizeDeviceText(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

export function getDeviceCategory(input?: string | null): DeviceCategory {
  const text = normalizeDeviceText(input);
  if (!text) return 'unknown';

  for (const item of DEVICE_PATTERNS) {
    if (item.test.test(text)) return item.category;
  }

  return 'unknown';
}

export function getDeviceCategoryFromUserAgent(userAgent?: string | null): DeviceCategory {
  const ua = normalizeDeviceText(userAgent);
  if (!ua) return 'unknown';

  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/android/.test(ua) && !/mobile/.test(ua)) return 'mobile';
  if (/iphone|ios|mobile|handset|phone/.test(ua)) return 'mobile';
  if (/tv|smart tv|android tv|apple tv|fire tv|webos/.test(ua)) return 'tv';
  if (/windows|macintosh|mac os|macos|os x|linux|chrome os|desktop|pc|laptop|notebook/.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

export function getDeviceCategoryForDisplay(deviceName?: string | null, userAgent?: string | null) {
  const nameCategory = getDeviceCategory(deviceName);
  if (nameCategory !== 'unknown') return nameCategory;

  return getDeviceCategoryFromUserAgent(userAgent);
}

export function getDeviceDisplayLabel(deviceName?: string, userAgent?: string) {
  const deviceText = normalizeDeviceText(deviceName);
  const uaText = normalizeDeviceText(userAgent);
  const category = getDeviceCategoryForDisplay(deviceText, uaText);

  const browser =
    DESKTOP_BROWSER_PATTERNS.find(([pattern]) => pattern.test(uaText))?.[1] ||
    DESKTOP_BROWSER_PATTERNS.find(([pattern]) => pattern.test(deviceText))?.[1] ||
    '';

  const platform =
    PLATFORM_PATTERNS.find(([pattern]) => pattern.test(uaText))?.[1] ||
    PLATFORM_PATTERNS.find(([pattern]) => pattern.test(deviceText))?.[1] ||
    '';

  if (deviceName?.trim()) {
    if (category === 'desktop' || category === 'mobile' || category === 'tablet' || category === 'tv') {
      return deviceName.trim();
    }
  }

  if (browser && platform) return `${browser} trên ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return 'Thiết bị không xác định';
}

export function getDeviceDetailLabel(userAgent?: string) {
  const uaText = normalizeDeviceText(userAgent);
  const browser = DESKTOP_BROWSER_PATTERNS.find(([pattern]) => pattern.test(uaText))?.[1] || '';
  const platform = PLATFORM_PATTERNS.find(([pattern]) => pattern.test(uaText))?.[1] || '';

  const parts = [browser, platform].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return userAgent?.trim() || 'Thiết bị không xác định';
}
