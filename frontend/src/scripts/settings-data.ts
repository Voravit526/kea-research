/**
 * Settings Data Constants
 * Centralized data for settings modal options
 */

/**
 * Avatar emoji options for user profile
 */
export const AVATARS = [
  '😊', '😎', '🧑‍🎨', '🧑‍💻', '🧑‍🚀', '🧑‍🍳', '🧑‍🏫', '🧑‍🔬', '🧑‍🎤', '🧑‍🌾',
  '🧑‍⚖️', '🧑‍✈️', '🧑‍🚒', '🧙‍♂️', '🧝‍♀️', '🧛‍♂️', '🧞‍♀️', '🦊', '🐉', '👽',
  '🤖', '🦸‍♂️', '🧚‍♀️', '🐺', '💀', '👻'
] as const;

/**
 * Supported UI languages with flag emoji and native name
 * Format: { code: ISO code, flag: emoji, name: native language name }
 */
export const LANGUAGES = [
  { code: 'az', flag: '🇦🇿', name: 'Azərbaycan' },
  { code: 'id', flag: '🇮🇩', name: 'Bahasa Indonesia' },
  { code: 'ms', flag: '🇲🇾', name: 'Bahasa Melayu' },
  { code: 'jv', flag: '🇮🇩', name: 'Basa Jawa' },
  { code: 'bs', flag: '🇧🇦', name: 'Bosanski' },
  { code: 'ca', flag: '🇦🇩', name: 'Català' },
  { code: 'cy', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', name: 'Cymraeg' },
  { code: 'cs', flag: '🇨🇿', name: 'Čeština' },
  { code: 'da', flag: '🇩🇰', name: 'Dansk' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'et', flag: '🇪🇪', name: 'Eesti' },
  { code: 'en', flag: '🇺🇸', name: 'English (US)' },
  { code: 'en-AU', flag: '🇦🇺', name: 'English (AU)' },
  { code: 'en-GB', flag: '🇬🇧', name: 'English (UK)' },
  { code: 'en-IE', flag: '🇮🇪', name: 'English (IE)' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'eu', flag: '🇪🇸', name: 'Euskara' },
  { code: 'fil', flag: '🇵🇭', name: 'Filipino' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'ga', flag: '🇮🇪', name: 'Gaeilge' },
  { code: 'gl', flag: '🇪🇸', name: 'Galego' },
  { code: 'gd', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', name: 'Gàidhlig' },
  { code: 'ha', flag: '🇳🇬', name: 'Hausa' },
  { code: 'hr', flag: '🇭🇷', name: 'Hrvatski' },
  { code: 'is', flag: '🇮🇸', name: 'Íslenska' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'sw', flag: '🇰🇪', name: 'Kiswahili' },
  { code: 'lv', flag: '🇱🇻', name: 'Latviešu' },
  { code: 'lb', flag: '🇱🇺', name: 'Lëtzebuergesch' },
  { code: 'lt', flag: '🇱🇹', name: 'Lietuvių' },
  { code: 'hu', flag: '🇭🇺', name: 'Magyar' },
  { code: 'mt', flag: '🇲🇹', name: 'Malti' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'no', flag: '🇳🇴', name: 'Norsk' },
  { code: 'pl', flag: '🇵🇱', name: 'Polski' },
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
  { code: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil)' },
  { code: 'ro', flag: '🇷🇴', name: 'Română' },
  { code: 'sq', flag: '🇦🇱', name: 'Shqip' },
  { code: 'sk', flag: '🇸🇰', name: 'Slovenčina' },
  { code: 'sl', flag: '🇸🇮', name: 'Slovenščina' },
  { code: 'fi', flag: '🇫🇮', name: 'Suomi' },
  { code: 'sv', flag: '🇸🇪', name: 'Svenska' },
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'yo', flag: '🇳🇬', name: 'Yoruba' },
  { code: 'el', flag: '🇬🇷', name: 'Ελληνικά' },
  { code: 'be', flag: '🇧🇾', name: 'Беларуская' },
  { code: 'bg', flag: '🇧🇬', name: 'Български' },
  { code: 'kk', flag: '🇰🇿', name: 'Қазақша' },
  { code: 'mk', flag: '🇲🇰', name: 'Македонски' },
  { code: 'sr', flag: '🇷🇸', name: 'Српски' },
  { code: 'uk', flag: '🇺🇦', name: 'Українська' },
  { code: 'ka', flag: '🇬🇪', name: 'ქართული' },
  { code: 'hy', flag: '🇦🇲', name: 'Հdelays' },
  { code: 'he', flag: '🇮🇱', name: 'עברית' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'fa', flag: '🇮🇷', name: 'فارسی' },
  { code: 'ur', flag: '🇵🇰', name: 'اردو' },
  { code: 'am', flag: '🇪🇹', name: 'አማርኛ' },
  { code: 'bn', flag: '🇧🇩', name: 'বাংলা' },
  { code: 'gu', flag: '🇮🇳', name: 'ગુજરાતી' },
  { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
  { code: 'pa', flag: '🇮🇳', name: 'ਪੰਜਾਬੀ' },
  { code: 'kn', flag: '🇮🇳', name: 'ಕನ್ನಡ' },
  { code: 'mr', flag: '🇮🇳', name: 'मराठी' },
  { code: 'ta', flag: '🇮🇳', name: 'தமிழ்' },
  { code: 'te', flag: '🇮🇳', name: 'తెలుగు' },
  { code: 'my', flag: '🇲🇲', name: 'မြန်မာစာ' },
  { code: 'th', flag: '🇹🇭', name: 'ไทย' },
  { code: 'zh', flag: '🇨🇳', name: '中文 (简体)' },
  { code: 'zh-TW', flag: '🇹🇼', name: '中文 (繁體)' },
  { code: 'zh-HK', flag: '🇭🇰', name: '中文 (香港)' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
] as const;

/**
 * Background image options for chat
 */
export const BACKGROUND_OPTIONS = [
  { id: 'none', preview: null, label: 'None' },
  { id: 'bg1', url: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg1.jpg', preview: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg1-200.jpg', label: 'Gradient' },
  { id: 'bg2', url: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg2.jpg', preview: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg2-200.jpg', label: 'Abstract' },
  { id: 'bg3', url: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg3.jpg', preview: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg3-200.jpg', label: 'Pattern' },
  { id: 'bg4', url: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg4.jpg', preview: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg4-200.jpg', label: 'Pattern' },
  { id: 'bg5', url: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg5.jpg', preview: 'https://cdn.jsdelivr.net/gh/keabase/web@main/dist/img/chat-bg/bg5-200.jpg', label: 'Pattern' },
] as const;
