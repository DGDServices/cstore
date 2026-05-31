const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Fallback language if translation is missing
    fallbackLng: process.env.DEFAULT_LANGUAGE || 'en',
    
    // Supported languages
    supportedLngs: ['en', 'es', 'fr', 'de', 'zh'],
    
    // Allow only languages defined in supportedLngs
    nonExplicitSupportedLngs: false,
    
    // Namespace for translations
    ns: ['translation', 'emails', 'errors'],
    defaultNS: 'translation',
    
    // Backend options
    backend: {
      loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
      addPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.missing.json')
    },
    
    // Detection options
    detection: {
      // Order of language detection
      order: ['querystring', 'header', 'cookie'],
      
      // Keys to look for in querystring
      lookupQuerystring: 'lng',
      
      // Keys to look for in cookie
      lookupCookie: 'i18next',
      
      // Cache language in cookie
      caches: ['cookie'],
      
      // Cookie options
      cookieOptions: { 
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: false,
        sameSite: 'lax'
      }
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false // Not needed for server-side
    },
    
    // Logging (disabled in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Save missing translations
    saveMissing: process.env.NODE_ENV === 'development',
    
    // Return empty string for missing keys
    returnEmptyString: false,
    
    // Return null for missing keys
    returnNull: false
  });

module.exports = i18next;
