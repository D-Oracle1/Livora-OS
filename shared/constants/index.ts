// ===========================================
// Livora OS - Shared Constants
// ===========================================

// API Versions
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// Pagination Defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Commission Rates by Tier
export const COMMISSION_RATES = {
  BRONZE: 0.03, // 3%
  SILVER: 0.035, // 3.5%
  GOLD: 0.04, // 4%
  PLATINUM: 0.05, // 5%
} as const;

// Tax Rate
export const DEFAULT_TAX_RATE = 0.15; // 15%

// Loyalty Points Configuration
export const LOYALTY_CONFIG = {
  POINTS_PER_SALE: 100,
  BONUS_MULTIPLIER: {
    BRONZE: 1,
    SILVER: 1.25,
    GOLD: 1.5,
    PLATINUM: 2,
  },
  TIER_THRESHOLDS: {
    BRONZE: 0,
    SILVER: 5000,
    GOLD: 15000,
    PLATINUM: 50000,
  },
} as const;

// Achievement Badges
export const ACHIEVEMENTS = {
  FIRST_SALE: {
    id: 'first_sale',
    name: 'First Sale',
    description: 'Completed your first property sale',
    icon: '🏆',
    points: 500,
  },
  TEN_SALES: {
    id: 'ten_sales',
    name: 'Rising Star',
    description: 'Completed 10 property sales',
    icon: '⭐',
    points: 1000,
  },
  FIFTY_SALES: {
    id: 'fifty_sales',
    name: 'Sales Expert',
    description: 'Completed 50 property sales',
    icon: '🌟',
    points: 5000,
  },
  HUNDRED_SALES: {
    id: 'hundred_sales',
    name: 'Sales Legend',
    description: 'Completed 100 property sales',
    icon: '👑',
    points: 10000,
  },
  MILLION_DOLLAR: {
    id: 'million_dollar',
    name: 'Million Dollar Agent',
    description: 'Total sales value exceeded $1,000,000',
    icon: '💎',
    points: 5000,
  },
  REALTOR_OF_MONTH: {
    id: 'realtor_of_month',
    name: 'Realtor of the Month',
    description: 'Awarded Realtor of the Month',
    icon: '🥇',
    points: 2000,
  },
  REALTOR_OF_YEAR: {
    id: 'realtor_of_year',
    name: 'Realtor of the Year',
    description: 'Awarded Realtor of the Year',
    icon: '🏅',
    points: 10000,
  },
} as const;

// Theme Colors
export const THEME_COLORS = {
  PRIMARY: '#1F5625',
  PRIMARY_LIGHT: '#2A7A32',
  PRIMARY_DARK: '#163D1A',
  SECONDARY: '#F5F5F5',
  ACCENT: '#FFD700',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
  INFO: '#3B82F6',
} as const;

// Loyalty Tier Colors
export const TIER_COLORS = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
} as const;

// WebSocket Events
export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Sales
  SALE_NEW: 'sale:new',
  SALE_UPDATED: 'sale:updated',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  CHAT_JOIN_ROOM: 'chat:join',
  CHAT_LEAVE_ROOM: 'chat:leave',

  // Rankings
  RANKING_UPDATED: 'ranking:updated',

  // Loyalty
  LOYALTY_UPDATED: 'loyalty:updated',

  // Properties
  PROPERTY_LISTED: 'property:listed',
  PROPERTY_SOLD: 'property:sold',
  PROPERTY_PRICE_CHANGED: 'property:price_changed',

  // Offers
  OFFER_NEW: 'offer:new',
  OFFER_UPDATED: 'offer:updated',

  // Dashboard
  DASHBOARD_UPDATE: 'dashboard:update',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User with this email already exists',
  INVALID_TOKEN: 'Invalid or expired token',
  SERVER_ERROR: 'An unexpected error occurred',
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// File Upload Limits
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MAX_IMAGES_PER_PROPERTY: 20,
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  DEFAULT: {
    ttl: 60,
    max: 100,
  },
  AUTH: {
    ttl: 60,
    max: 10,
  },
  API: {
    ttl: 60,
    max: 200,
  },
} as const;
