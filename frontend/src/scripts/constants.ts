/**
 * Shared Constants and Configuration
 */

// ========== Storage Keys ==========
export const STORAGE_KEYS = {
  USER_TOKEN: 'kea_user_token',
  USER: 'kea_user',
  ADMIN_TOKEN: 'kea_admin_token',
  LANGUAGE: 'kea_lang',
} as const;

// ========== Image Compression ==========
export const IMAGE_CONFIG = {
  AVATAR_MAX_SIZE_MB: 0.5,
  AVATAR_MAX_DIMENSION: 200,
  AVATAR_QUALITY: 0.9,
  BACKGROUND_MAX_SIZE_MB: 2,
  BACKGROUND_MAX_DIMENSION_HIDPI: 3840,
  BACKGROUND_MAX_DIMENSION_STANDARD: 1920,
  BACKGROUND_QUALITY: 0.85,
  ATTACHMENT_MAX_DIMENSION: 2048,
  ATTACHMENT_DEFAULT_QUALITY: 85,
} as const;

// ========== UI Configuration ==========
export const UI_CONFIG = {
  TOAST_DURATION_MS: 2000,
  SIDEBAR_BREAKPOINT: 992,
  SIDEBAR_WIDTH: '250px',
  SIDEBAR_Z_INDEX: '1050',
  COOKIE_MAX_AGE_SECONDS: 31536000, // 1 year
} as const;

// ========== Provider Icons (SVG) ==========
// Default SVG icons for each provider type
// Format: single SVG or "lightSvg|||darkSvg" for theme-aware icons
export const PROVIDER_ICONS: Record<string, string> = {
  openai: '<svg fill="currentColor" fill-rule="evenodd" height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenAI</title><path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path></svg>',
  anthropic: '<svg height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"></path></svg>',
  google: '<svg height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Gemini</title><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#gemini-g0)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#gemini-g1)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#gemini-g2)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="gemini-g0" x1="7" x2="11" y1="15.5" y2="12"><stop stop-color="#08B962"></stop><stop offset="1" stop-color="#08B962" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="gemini-g1" x1="8" x2="11.5" y1="5.5" y2="11"><stop stop-color="#F94543"></stop><stop offset="1" stop-color="#F94543" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="gemini-g2" x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stop-color="#FABC12"></stop><stop offset=".46" stop-color="#FABC12" stop-opacity="0"></stop></linearGradient></defs></svg>',
  mistral: '<svg height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Mistral</title><path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold"></path><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00"></path><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205"></path><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F"></path><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500"></path></svg>',
  xai: '<svg fill="currentColor" height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Grok</title><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"></path></svg>',
  openrouter: '<svg fill="currentColor" fill-rule="evenodd" height="1em" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenRouter</title><path d="M16.804 1.957l7.22 4.105v.087L16.73 10.21l.017-2.117-.821-.03c-1.059-.028-1.611.002-2.268.11-1.064.175-2.038.577-3.147 1.352L8.345 11.03c-.284.195-.495.336-.68.455l-.515.322-.397.234.385.23.53.338c.476.314 1.17.796 2.701 1.866 1.11.775 2.083 1.177 3.147 1.352l.3.045c.694.091 1.375.094 2.825.033l.022-2.159 7.22 4.105v.087L16.589 22l.014-1.862-.635.022c-1.386.042-2.137.002-3.138-.162-1.694-.28-3.26-.926-4.881-2.059l-2.158-1.5a21.997 21.997 0 00-.755-.498l-.467-.28a55.927 55.927 0 00-.76-.43C2.908 14.73.563 14.116 0 14.116V9.888l.14.004c.564-.007 2.91-.622 3.809-1.124l1.016-.58.438-.274c.428-.28 1.072-.726 2.686-1.853 1.621-1.133 3.186-1.78 4.881-2.059 1.152-.19 1.974-.213 3.814-.138l.02-1.907z"></path></svg>',
  'openai-compatible': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 0a.5.5 0 0 1 .5.5V3h3V.5a.5.5 0 0 1 1 0V3h1a.5.5 0 0 1 .5.5v3A3.5 3.5 0 0 1 8.5 10c-.002.434-.01.845-.04 1.22-.041.514-.126 1.003-.317 1.424a2.08 2.08 0 0 1-.97 1.028C6.725 13.9 6.169 14 5.5 14c-.998 0-1.61.33-1.974.718A1.92 1.92 0 0 0 3 16H2c0-.616.232-1.367.797-1.968C3.374 13.42 4.261 13 5.5 13c.581 0 .962-.088 1.218-.219.241-.123.4-.3.514-.55.121-.266.193-.621.23-1.09.027-.34.035-.718.037-1.141A3.5 3.5 0 0 1 4 6.5v-3a.5.5 0 0 1 .5-.5h1V.5A.5.5 0 0 1 6 0M5 4v2.5A2.5 2.5 0 0 0 7.5 9h1A2.5 2.5 0 0 0 11 6.5V4z"/></svg>',
};

// Icon delimiter for light/dark mode: "lightSvg|||darkSvg"
const ICON_THEME_DELIMITER = '|||';

/**
 * Get current theme (light or dark)
 */
function getCurrentTheme(): 'light' | 'dark' {
  const html = document.documentElement;
  const theme = html.getAttribute('data-bs-theme');
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  // Auto - check system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Sanitize SVG by parsing and removing potentially dangerous elements/attributes
 */
function sanitizeSvg(svgString: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    // Check for parse errors
    if (!svg || doc.querySelector('parsererror')) {
      return null;
    }

    // Remove dangerous elements
    const dangerousElements = ['script', 'foreignObject', 'use', 'iframe', 'embed', 'object'];
    for (let i = 0; i < dangerousElements.length; i++) {
      const elements = svg.querySelectorAll(dangerousElements[i]);
      for (let j = 0; j < elements.length; j++) {
        elements[j].remove();
      }
    }

    // Remove dangerous attributes (event handlers and external references)
    const dangerousAttrs = /^(on|xlink:href|href|style)/i;
    const removeAttrs = (el: Element) => {
      const attrs: Attr[] = [];
      for (let i = 0; i < el.attributes.length; i++) {
        attrs.push(el.attributes[i]);
      }
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (dangerousAttrs.test(attr.name)) {
          // Allow href only for internal references (starts with #)
          if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.indexOf('#') === 0) {
            continue;
          }
          // Allow style only for safe properties
          if (attr.name === 'style') {
            const safeStyle = attr.value.replace(/[^a-z0-9:;%#.\s-]/gi, '');
            el.setAttribute('style', safeStyle);
            continue;
          }
          el.removeAttribute(attr.name);
        }
      }
      // Recursively process children
      for (let i = 0; i < el.children.length; i++) {
        removeAttrs(el.children[i]);
      }
    };
    removeAttrs(svg);

    return svg.outerHTML;
  } catch {
    return null;
  }
}

/**
 * Normalize SVG to consistent display size
 * Supports theme-aware icons: "lightSvg|||darkSvg"
 */
export function normalizeSvgIcon(svg: string): string {
  if (!svg) {
    return '<i class="bi-robot"></i>'; // Fallback
  }

  // Handle theme-aware icons
  let iconSvg = svg;
  if (svg.indexOf(ICON_THEME_DELIMITER) !== -1) {
    const [lightIcon, darkIcon] = svg.split(ICON_THEME_DELIMITER);
    iconSvg = getCurrentTheme() === 'dark' ? darkIcon : lightIcon;
  }

  // Validate and sanitize SVG
  if (iconSvg.trim().indexOf('<svg') !== 0) {
    return '<i class="bi-robot"></i>'; // Fallback
  }

  const sanitized = sanitizeSvg(iconSvg);
  if (!sanitized) {
    return '<i class="bi-robot"></i>'; // Fallback
  }

  // Wrap SVG in a container that normalizes its size
  return `<span style="display:inline-flex;width:1em;height:1em;align-items:center;justify-content:center;">${sanitized.replace(/<svg/, '<svg style="width:100%;height:100%;max-width:100%;max-height:100%"')}</span>`;
}

// Provider display config for pipeline
export interface ProviderConfig {
  name: string;
  icon: string;
  color: string;
}

// Official brand colors
export const PROVIDER_COLORS = {
  claude: '#D97757',   // Anthropic terra-cotta
  openai: '#10A37F',   // OpenAI green
  gemini: '#4285F4',   // Google blue
  mistral: '#FF8205',  // Mistral orange
  grok: '#000000',     // xAI black
} as const;

// Map provider_type and provider name to icon config
export const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  // By provider name (used in chat/pipeline)
  claude: { name: 'Claude', icon: PROVIDER_ICONS.anthropic, color: PROVIDER_COLORS.claude },
  openai: { name: 'ChatGPT', icon: PROVIDER_ICONS.openai, color: PROVIDER_COLORS.openai },
  gemini: { name: 'Gemini', icon: PROVIDER_ICONS.google, color: PROVIDER_COLORS.gemini },
  mistral: { name: 'Mistral', icon: PROVIDER_ICONS.mistral, color: PROVIDER_COLORS.mistral },
  grok: { name: 'Grok', icon: PROVIDER_ICONS.xai, color: PROVIDER_COLORS.grok },
  // By provider_type (used in admin page)
  anthropic: { name: 'Claude', icon: PROVIDER_ICONS.anthropic, color: PROVIDER_COLORS.claude },
  google: { name: 'Gemini', icon: PROVIDER_ICONS.google, color: PROVIDER_COLORS.gemini },
  xai: { name: 'Grok', icon: PROVIDER_ICONS.xai, color: PROVIDER_COLORS.grok },
  openrouter: { name: 'OpenRouter', icon: PROVIDER_ICONS.openrouter, color: '#6366F1' },
  'openai-compatible': { name: 'Custom', icon: PROVIDER_ICONS['openai-compatible'], color: '#6c757d' },
};

// Provider cache for custom icons from database
export interface CachedProvider {
  name: string;
  display_name: string;
  icon: string | null;
}

let providerCache: Record<string, CachedProvider> = {};

export function setProviderCache(providers: CachedProvider[]): void {
  providerCache = {};
  for (const p of providers) {
    providerCache[p.name] = p;
  }
}

export function getProviderCache(): Record<string, CachedProvider> {
  return providerCache;
}

/**
 * Get provider icon HTML (SVG-based)
 * @param providerName - The provider name (e.g., "claude", "mistral")
 * @param customIcon - Optional custom SVG icon override
 * @param defaultIcon - Fallback SVG icon if not found
 */
export function getProviderIconHtml(
  providerName: string,
  customIcon?: string | null,
  defaultIcon = PROVIDER_ICONS['openai-compatible']
): string {
  // Determine which icon to use:
  // 1. Explicit customIcon parameter
  // 2. Custom icon from provider cache (database)
  // 3. Default from PROVIDER_CONFIG
  // 4. Default fallback
  let icon = customIcon;

  if (!icon) {
    // Check provider cache for custom icon from database
    const cached = providerCache[providerName];
    if (cached?.icon) {
      icon = cached.icon;
    }
  }

  if (!icon) {
    // Fall back to PROVIDER_CONFIG defaults
    const config = PROVIDER_CONFIG[providerName];
    if (config) {
      icon = config.icon;
    }
  }

  if (!icon) {
    icon = defaultIcon;
  }

  // Normalize and return SVG icon
  return normalizeSvgIcon(icon);
}

/**
 * Get complete provider display info (config, display name, and icon HTML)
 * @param provider - The provider name
 * @returns Object with config, displayName, and iconHtml
 */
export function getProviderDisplay(provider: string): {
  config: ProviderConfig;
  displayName: string;
  iconHtml: string;
} {
  const config = PROVIDER_CONFIG[provider] || { name: provider, icon: 'bi-robot', color: '#6c757d' };
  const cached = providerCache[provider];
  const displayName = cached?.display_name || config.name;
  const iconHtml = `<span>${getProviderIconHtml(provider)}</span>`;
  return { config, displayName, iconHtml };
}
