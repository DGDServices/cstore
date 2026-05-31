const request = require('supertest');
const i18next = require('../src/config/i18n');

// Skip database connection for i18n tests
process.env.SKIP_DB_CONNECTION = 'true';

// Wait for i18next to initialize
beforeAll(async () => {
  // Give i18next time to load translation files
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Internationalization (i18n)', () => {
  // Load app after setting environment
  let app;
  
  beforeAll(() => {
    app = require('../src/app');
  });

  describe('i18n Configuration', () => {
    it('should have i18next initialized', () => {
      expect(i18next).toBeDefined();
      expect(typeof i18next.t).toBe('function');
    });

    it('should support English (en)', () => {
      const t = i18next.getFixedT('en');
      expect(t('common.success')).toBe('Success');
      expect(t('app.name')).toBe('CStore');
    });

    it('should support Spanish (es)', () => {
      const t = i18next.getFixedT('es');
      expect(t('common.success')).toBe('Éxito');
      expect(t('app.name')).toBe('CStore');
    });

    it('should support French (fr)', () => {
      const t = i18next.getFixedT('fr');
      expect(t('common.success')).toBe('Succès');
      expect(t('app.tagline')).toBe('Marché de Cryptomonnaie');
    });

    it('should support German (de)', () => {
      const t = i18next.getFixedT('de');
      expect(t('common.success')).toBe('Erfolg');
      expect(t('app.tagline')).toBe('Kryptowährungs-Marktplatz');
    });

    it('should support Chinese (zh)', () => {
      const t = i18next.getFixedT('zh');
      expect(t('common.success')).toBe('成功');
      expect(t('app.tagline')).toBe('加密货币市场');
    });

    it('should fallback to English for unsupported language', () => {
      const t = i18next.getFixedT('unsupported');
      expect(t('common.success')).toBe('Success');
    });
  });

  describe('API Language Detection', () => {
    it('should detect language from Accept-Language header', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Language', 'es');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('es');
    });

    it('should detect language from query parameter', async () => {
      const response = await request(app)
        .get('/api/health?lng=fr');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('fr');
    });

    it('should use English as default language', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('en');
    });

    it('should translate health check message in English', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Language', 'en');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Server is running');
    });

    it('should translate health check message in Spanish', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Language', 'es');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('El servidor está funcionando');
    });

    it('should translate health check message in French', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Language', 'fr');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Le serveur est en cours d\'exécution');
    });
  });

  describe('Translation Namespaces', () => {
    it('should load translation namespace', () => {
      const t = i18next.getFixedT('en', 'translation');
      expect(t('product.products')).toBe('Products');
      expect(t('order.orders')).toBe('Orders');
    });

    it('should load errors namespace', () => {
      const t = i18next.getFixedT('en', 'errors');
      expect(t('general.notFound')).toBe('Resource not found');
      expect(t('auth.invalidCredentials')).toBe('Invalid email or password');
    });

    it('should load emails namespace', () => {
      const t = i18next.getFixedT('en', 'emails');
      expect(t('welcome.subject')).toBe('Welcome to CStore!');
      expect(t('welcome.title')).toBe('Welcome to CStore');
    });
  });

  describe('Translation Interpolation', () => {
    it('should interpolate variables in English', () => {
      const t = i18next.getFixedT('en', 'emails');
      const greeting = t('welcome.greeting', { name: 'John' });
      expect(greeting).toBe('Hello John!');
    });

    it('should interpolate variables in Spanish', () => {
      const t = i18next.getFixedT('es', 'emails');
      const greeting = t('welcome.greeting', { name: 'Juan' });
      expect(greeting).toBe('¡Hola Juan!');
    });

    it('should interpolate variables in Chinese', () => {
      const t = i18next.getFixedT('zh', 'emails');
      const greeting = t('welcome.greeting', { name: '李明' });
      expect(greeting).toBe('你好，李明！');
    });

    it('should interpolate order number in emails', () => {
      const t = i18next.getFixedT('en', 'emails');
      const subject = t('orderConfirmation.subject', { orderNumber: '12345' });
      expect(subject).toBe('Order Confirmation #12345');
    });
  });

  describe('Email Service i18n', () => {
    const emailService = require('../src/services/emailService');

    it('should have i18n-aware email functions', () => {
      expect(typeof emailService.sendWelcomeEmail).toBe('function');
      expect(typeof emailService.sendOrderConfirmationEmail).toBe('function');
      expect(typeof emailService.sendPaymentConfirmationEmail).toBe('function');
    });
  });

  describe('Language Persistence', () => {
    it('should detect language from cookie', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Cookie', 'i18next=de');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('de');
    });

    it('should prioritize query parameter over cookie', async () => {
      const response = await request(app)
        .get('/api/health?lng=es')
        .set('Cookie', 'i18next=de');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('es');
    });

    it('should prioritize query parameter over Accept-Language header', async () => {
      const response = await request(app)
        .get('/api/health?lng=fr')
        .set('Accept-Language', 'de');

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('fr');
    });
  });

  describe('Supported Languages', () => {
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh'];

    supportedLanguages.forEach(lang => {
      it(`should support ${lang} language`, () => {
        const t = i18next.getFixedT(lang);
        expect(t('app.name')).toBeTruthy();
        expect(t('common.success')).toBeTruthy();
      });
    });
  });

  describe('Translation Completeness', () => {
    it('should have all common translations in all languages', () => {
      const languages = ['en', 'es', 'fr', 'de', 'zh'];
      const commonKeys = [
        'common.success',
        'common.error',
        'common.loading',
        'app.name',
        'app.tagline'
      ];

      languages.forEach(lang => {
        const t = i18next.getFixedT(lang);
        commonKeys.forEach(key => {
          const translation = t(key);
          expect(translation).toBeTruthy();
          expect(translation).not.toBe(key); // Should not return the key itself
        });
      });
    });

    it('should have product translations in all languages', () => {
      const languages = ['en', 'es', 'fr', 'de', 'zh'];
      const productKeys = [
        'product.products',
        'product.price',
        'product.addToCart'
      ];

      languages.forEach(lang => {
        const t = i18next.getFixedT(lang);
        productKeys.forEach(key => {
          const translation = t(key);
          expect(translation).toBeTruthy();
        });
      });
    });
  });
});
