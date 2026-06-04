// ===========================================
// Livora OS - Shared Types
// ===========================================

// User Roles
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  REALTOR = 'REALTOR',
  CLIENT = 'CLIENT',
}

// User Status
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

// Property Status
export enum PropertyStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  PENDING = 'PENDING',
  LISTED = 'LISTED',
  OFF_MARKET = 'OFF_MARKET',
  UNDER_CONTRACT = 'UNDER_CONTRACT',
}

// Property Type
export enum PropertyType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  LAND = 'LAND',
  MIXED_USE = 'MIXED_USE',
  APARTMENT = 'APARTMENT',
  CONDO = 'CONDO',
  TOWNHOUSE = 'TOWNHOUSE',
  VILLA = 'VILLA',
}

// Sale Status
export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  IN_PROGRESS = 'IN_PROGRESS',
}

// Commission Status
export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
}

// Loyalty Tier
export enum LoyaltyTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

// Notification Type
export enum NotificationType {
  SALE = 'SALE',
  COMMISSION = 'COMMISSION',
  PROPERTY = 'PROPERTY',
  RANKING = 'RANKING',
  LOYALTY = 'LOYALTY',
  SYSTEM = 'SYSTEM',
  CHAT = 'CHAT',
  PRICE_CHANGE = 'PRICE_CHANGE',
  LISTING = 'LISTING',
  OFFER = 'OFFER',
}

// Notification Priority
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Chat Message Type
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  PROPERTY = 'PROPERTY',
  SYSTEM = 'SYSTEM',
}

// Document Type
export enum DocumentType {
  CONTRACT = 'CONTRACT',
  DEED = 'DEED',
  INSPECTION = 'INSPECTION',
  APPRAISAL = 'APPRAISAL',
  TITLE = 'TITLE',
  TAX = 'TAX',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

// Transaction Type
export enum TransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  COMMISSION = 'COMMISSION',
  TAX = 'TAX',
  BONUS = 'BONUS',
  REFUND = 'REFUND',
}

// Ranking Period
export enum RankingPeriod {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  ALL_TIME = 'ALL_TIME',
}

// Base Entity Interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Interface
export interface IUser extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
}

// Admin Interface
export interface IAdmin extends IUser {
  role: UserRole.ADMIN | UserRole.SUPER_ADMIN;
  permissions: string[];
}

// Realtor Interface
export interface IRealtor extends IUser {
  role: UserRole.REALTOR;
  licenseNumber: string;
  agency?: string;
  bio?: string;
  specializations: string[];
  totalSales: number;
  totalCommission: number;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  ranking: number;
  isRealtorOfMonth: boolean;
  isRealtorOfYear: boolean;
}

// Client Interface
export interface IClient extends IUser {
  role: UserRole.CLIENT;
  realtorId?: string;
  properties: string[];
  totalPurchaseValue: number;
}

// Property Interface
export interface IProperty extends BaseEntity {
  title: string;
  description: string;
  type: PropertyType;
  status: PropertyStatus;
  address: IAddress;
  price: number;
  originalPrice: number;
  appreciationPercentage: number;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  yearBuilt?: number;
  features: string[];
  images: string[];
  documents: string[];
  ownerId?: string;
  realtorId?: string;
  isListed: boolean;
  listingPrice?: number;
  offers: IOffer[];
}

// Address Interface
export interface IAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

// Sale Interface
export interface ISale extends BaseEntity {
  propertyId: string;
  realtorId: string;
  clientId: string;
  salePrice: number;
  saleDate: Date;
  status: SaleStatus;
  commissionRate: number;
  commissionAmount: number;
  taxAmount: number;
  netAmount: number;
  notes?: string;
}

// Commission Interface
export interface ICommission extends BaseEntity {
  saleId: string;
  realtorId: string;
  amount: number;
  rate: number;
  status: CommissionStatus;
  paidAt?: Date;
}

// Tax Interface
export interface ITax extends BaseEntity {
  saleId: string;
  realtorId: string;
  amount: number;
  rate: number;
  year: number;
  quarter: number;
}

// Loyalty Points Interface
export interface ILoyaltyPoints extends BaseEntity {
  realtorId: string;
  points: number;
  tier: LoyaltyTier;
  source: string;
  saleId?: string;
}

// Ranking Interface
export interface IRanking extends BaseEntity {
  realtorId: string;
  period: RankingPeriod;
  periodStart: Date;
  periodEnd: Date;
  rank: number;
  totalSales: number;
  totalValue: number;
  score: number;
}

// Chat Room Interface
export interface IChatRoom extends BaseEntity {
  participants: string[];
  type: 'DIRECT' | 'GROUP';
  name?: string;
  lastMessage?: IMessage;
  unreadCount: number;
}

// Message Interface
export interface IMessage extends BaseEntity {
  roomId: string;
  senderId: string;
  content: string;
  type: MessageType;
  attachments?: IAttachment[];
  readBy: string[];
}

// Attachment Interface
export interface IAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

// Notification Interface
export interface INotification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  data?: Record<string, any>;
  link?: string;
}

// Offer Interface
export interface IOffer extends BaseEntity {
  propertyId: string;
  buyerId: string;
  amount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
  message?: string;
  counterAmount?: number;
  expiresAt: Date;
}

// Document Interface
export interface IDocument extends BaseEntity {
  propertyId: string;
  type: DocumentType;
  name: string;
  url: string;
  size: number;
  uploadedBy: string;
}

// Transaction Interface
export interface ITransaction extends BaseEntity {
  type: TransactionType;
  amount: number;
  fromUserId?: string;
  toUserId?: string;
  referenceId: string;
  referenceType: string;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

// Audit Log Interface
export interface IAuditLog extends BaseEntity {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Dashboard Stats Interface
export interface IDashboardStats {
  totalSales: number;
  monthlySales: number;
  totalCommission: number;
  monthlyCommission: number;
  totalTax: number;
  netEarnings: number;
  totalProperties: number;
  activeListings: number;
  pendingSales: number;
  totalClients: number;
  loyaltyPoints: number;
  ranking: number;
}

// Analytics Interface
export interface IAnalytics {
  period: string;
  sales: number;
  revenue: number;
  commission: number;
  growth: number;
}

// API Response Interface
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination Interface
export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// WebSocket Event Types
export type WebSocketEvent =
  | 'sale:new'
  | 'sale:updated'
  | 'notification:new'
  | 'chat:message'
  | 'chat:typing'
  | 'ranking:updated'
  | 'loyalty:updated'
  | 'property:listed'
  | 'property:sold'
  | 'offer:new'
  | 'offer:updated';

// WebSocket Payload
export interface IWebSocketPayload<T = any> {
  event: WebSocketEvent;
  data: T;
  timestamp: Date;
  userId?: string;
}
