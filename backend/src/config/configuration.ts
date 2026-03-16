export default () => ({
  // Application
  port: parseInt(process.env.BACKEND_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'RMS Platform',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'rms_db',
    user: process.env.DB_USER || 'rms_user',
    password: process.env.DB_PASSWORD || 'rms_password',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rms_chat',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
  },

  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || 'noreply@rms-platform.com',
  },

  // SMS (Twilio)
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Push Notifications (Web Push)
  webPush: {
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@rms-platform.com',
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'rms-platform-files',
  },

  // CDN (optional — set to a CloudFront or custom CDN URL to rewrite blob URLs)
  cdn: {
    baseUrl: process.env.CDN_BASE_URL,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Commission Configuration
  commission: {
    defaultRate: parseFloat(process.env.DEFAULT_COMMISSION_RATE || '0.03'),
    bronzeRate: parseFloat(process.env.BRONZE_COMMISSION_RATE || '0.03'),
    silverRate: parseFloat(process.env.SILVER_COMMISSION_RATE || '0.035'),
    goldRate: parseFloat(process.env.GOLD_COMMISSION_RATE || '0.04'),
    platinumRate: parseFloat(process.env.PLATINUM_COMMISSION_RATE || '0.05'),
  },

  // Tax Configuration
  tax: {
    defaultRate: parseFloat(process.env.DEFAULT_TAX_RATE || '0.15'),
  },

  // Loyalty Configuration
  loyalty: {
    pointsPerSale: parseInt(process.env.POINTS_PER_SALE || '100', 10),
    bronzeThreshold: parseInt(process.env.BRONZE_THRESHOLD || '0', 10),
    silverThreshold: parseInt(process.env.SILVER_THRESHOLD || '5000', 10),
    goldThreshold: parseInt(process.env.GOLD_THRESHOLD || '15000', 10),
    platinumThreshold: parseInt(process.env.PLATINUM_THRESHOLD || '50000', 10),
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Sentry error monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  },

  // OAuth
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
    },
  },

  // Logging
  logtail: {
    token: process.env.LOGTAIL_TOKEN,
  },
});
