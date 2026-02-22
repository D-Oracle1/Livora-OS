-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'GENERAL_OVERSEER', 'ADMIN', 'HR', 'REALTOR', 'CLIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE', 'APARTMENT', 'CONDO', 'TOWNHOUSE', 'VILLA');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'SOLD', 'PENDING', 'LISTED', 'OFF_MARKET', 'UNDER_CONTRACT');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SALE', 'COMMISSION', 'PROPERTY', 'RANKING', 'LOYALTY', 'SYSTEM', 'CHAT', 'PRICE_CHANGE', 'LISTING', 'OFFER', 'AWARD', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'REVIEW_SCHEDULED', 'REVIEW_COMPLETED', 'MENTION', 'CHANNEL_INVITE', 'PAYROLL_PROCESSED', 'CALLOUT', 'CALLOUT_RESPONSE', 'ENGAGEMENT_POST', 'POST_COMMENT', 'POST_MENTION', 'EVENT_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'PROPERTY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'DEED', 'INSPECTION', 'APPRAISAL', 'TITLE', 'TAX', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'PURCHASE', 'COMMISSION', 'TAX', 'BONUS', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RankingPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AwardType" AS ENUM ('STAFF_OF_MONTH', 'REALTOR_OF_MONTH', 'CLIENT_OF_MONTH');

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('EXECUTIVE', 'DIRECTOR', 'MANAGER', 'TEAM_LEAD', 'SENIOR', 'JUNIOR', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'UNPAID', 'STUDY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewCycle" AS ENUM ('QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('DEPARTMENT', 'PROJECT', 'ANNOUNCEMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PAGE', 'BLOG_POST', 'ANNOUNCEMENT', 'FAQ');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('LATENESS', 'ABSENCE', 'LATE_TASK', 'EARLY_DEPARTURE', 'DRESS_CODE', 'MISCONDUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "AllowanceType" AS ENUM ('HOUSING', 'TRANSPORT', 'MEAL', 'MEDICAL', 'COMMUNICATION', 'ENTERTAINMENT', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('TAX', 'PENSION', 'HEALTH_INSURANCE', 'LOAN_REPAYMENT', 'LATENESS_PENALTY', 'ABSENCE_PENALTY', 'LATE_TASK_PENALTY', 'OTHER');

-- CreateEnum
CREATE TYPE "GalleryItemType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('NEWSLETTER', 'BIRTHDAY', 'PROPERTY_ALERT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('ALL', 'CLIENT', 'REALTOR', 'INVESTOR', 'STAFF');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'RECURRING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'LUXURY', 'CORPORATE');

-- CreateEnum
CREATE TYPE "CampaignLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "SubscriberRole" AS ENUM ('CLIENT', 'REALTOR', 'INVESTOR');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('ANNOUNCEMENT', 'PRODUCT_UPDATE', 'EDUCATIONAL_TIP', 'EVENT', 'POLL', 'CASE_STUDY', 'SPONSORED_FEATURE');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('HELPFUL', 'INSIGHTFUL', 'GAME_CHANGER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referralCode" TEXT,
    "referredBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "agency" TEXT,
    "bio" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalSalesValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTaxPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "currentRank" INTEGER NOT NULL DEFAULT 0,
    "isRealtorOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "isRealtorOfYear" BOOLEAN NOT NULL DEFAULT false,
    "realtorOfMonthCount" INTEGER NOT NULL DEFAULT 0,
    "realtorOfYearCount" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realtor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realtorId" TEXT,
    "totalPurchaseValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPropertyValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "currentRank" INTEGER NOT NULL DEFAULT 0,
    "isClientOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "isClientOfYear" BOOLEAN NOT NULL DEFAULT false,
    "clientOfMonthCount" INTEGER NOT NULL DEFAULT 0,
    "clientOfYearCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "price" DECIMAL(15,2) NOT NULL,
    "originalPrice" DECIMAL(15,2) NOT NULL,
    "listingPrice" DECIMAL(15,2),
    "pricePerSqm" DECIMAL(15,2),
    "numberOfPlots" INTEGER,
    "appreciationPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "area" DOUBLE PRECISION NOT NULL,
    "lotSize" DOUBLE PRECISION,
    "yearBuilt" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "virtualTourUrl" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    "listedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "realtorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "salePrice" DECIMAL(15,2) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DECIMAL(15,2) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "netAmount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "closingDate" TIMESTAMP(3),
    "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
    "numberOfInstallments" INTEGER NOT NULL DEFAULT 1,
    "totalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "nextPaymentDue" TIMESTAMP(3),
    "areaSold" DOUBLE PRECISION,
    "loyaltyPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "paymentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxes" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "saleId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalSales" INTEGER NOT NULL,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_rankings" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksOnTime" INTEGER NOT NULL DEFAULT 0,
    "attendanceDays" INTEGER NOT NULL DEFAULT 0,
    "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgReviewScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_rankings" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "propertiesOwned" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "totalPurchaseValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPropertyValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DECIMAL(15,2) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "netCommission" DECIMAL(15,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentMethod" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_awards" (
    "id" TEXT NOT NULL,
    "type" "AwardType" NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "counterAmount" DECIMAL(15,2),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachments" JSONB,
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "oldPrice" DECIMAL(15,2) NOT NULL,
    "newPrice" DECIMAL(15,2) NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "allowedModules" TEXT[],
    "parentId" TEXT,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "title" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "annualLeaveBalance" INTEGER NOT NULL DEFAULT 20,
    "sickLeaveBalance" INTEGER NOT NULL DEFAULT 10,
    "currentRank" INTEGER NOT NULL DEFAULT 0,
    "isStaffOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "isStaffOfYear" BOOLEAN NOT NULL DEFAULT false,
    "staffOfMonthCount" INTEGER NOT NULL DEFAULT 0,
    "staffOfYearCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_permissions" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL,
    "hoursWorked" DOUBLE PRECISION,
    "overtime" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "cycle" "ReviewCycle" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" DOUBLE PRECISION,
    "ratings" JSONB,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "goals" JSONB,
    "reviewerComments" TEXT,
    "revieweeComments" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "payDate" DATE,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "overtime" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "allowances" JSONB,
    "grossPay" DECIMAL(15,2) NOT NULL,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pension" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherDeductions" JSONB,
    "totalDeductions" DECIMAL(15,2) NOT NULL,
    "netPay" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "creatorId" TEXT,
    "createdByUserId" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "report_description" TEXT,
    "report_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyId" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChannelType" NOT NULL,
    "departmentId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "channelId" TEXT,
    "departmentId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "accessList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT true,
    "penaltyType" TEXT NOT NULL,
    "penaltyAmount" DECIMAL(15,2) NOT NULL,
    "penaltyBasis" TEXT,
    "graceMinutes" INTEGER,
    "maxOccurrences" INTEGER,
    "escalationRate" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_records" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "policyId" TEXT,
    "type" "PolicyType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedToPayrollId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "isWaived" BOOLEAN NOT NULL DEFAULT false,
    "waivedBy" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waiverReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AllowanceType" NOT NULL,
    "description" TEXT,
    "amountType" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "percentageBasis" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "positionLevels" "StaffPosition"[],
    "minServiceMonths" INTEGER,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deduction_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "description" TEXT,
    "amountType" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "percentageBasis" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "maxAmount" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deduction_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" "StaffPosition" NOT NULL,
    "minSalary" DECIMAL(15,2) NOT NULL,
    "maxSalary" DECIMAL(15,2) NOT NULL,
    "workHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "workDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "overtimeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "weekendRate" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "holidayRate" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "type" "GalleryItemType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceName" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "content" JSONB NOT NULL,
    "excerpt" TEXT,
    "featuredImage" TEXT,
    "metadata" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeToken" TEXT NOT NULL,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_subscribers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "dateOfBirth" DATE,
    "role" "SubscriberRole" NOT NULL DEFAULT 'CLIENT',
    "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "lastEmailAt" TIMESTAMP(3),
    "emailCount7d" INTEGER NOT NULL DEFAULT 0,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "campaignType" "CampaignType" NOT NULL,
    "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL',
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'IMMEDIATE',
    "scheduledAt" TIMESTAMP(3),
    "recurrenceRule" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "tone" "CampaignTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "subject" TEXT,
    "htmlContent" TEXT,
    "promptUsed" TEXT,
    "createdBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_logs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "CampaignLogStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_content_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "templateName" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "tone" "CampaignTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_content_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popup_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetRole" "AudienceType" NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "dismissedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popup_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "type" "PostType" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "externalLink" TEXT,
    "tags" JSONB,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "commentsDisabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_views" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_posts" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_analytics" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "aiInsightGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiRecommendationScore" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChatParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_referralCode_idx" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "realtor_profiles_userId_key" ON "realtor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "realtor_profiles_licenseNumber_key" ON "realtor_profiles"("licenseNumber");

-- CreateIndex
CREATE INDEX "realtor_profiles_licenseNumber_idx" ON "realtor_profiles"("licenseNumber");

-- CreateIndex
CREATE INDEX "realtor_profiles_loyaltyTier_idx" ON "realtor_profiles"("loyaltyTier");

-- CreateIndex
CREATE INDEX "realtor_profiles_currentRank_idx" ON "realtor_profiles"("currentRank");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- CreateIndex
CREATE INDEX "client_profiles_realtorId_idx" ON "client_profiles"("realtorId");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_isListed_idx" ON "properties"("isListed");

-- CreateIndex
CREATE INDEX "sales_realtorId_idx" ON "sales"("realtorId");

-- CreateIndex
CREATE INDEX "sales_clientId_idx" ON "sales"("clientId");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sales_saleDate_idx" ON "sales"("saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_saleId_key" ON "commissions"("saleId");

-- CreateIndex
CREATE INDEX "commissions_realtorId_idx" ON "commissions"("realtorId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "taxes_saleId_key" ON "taxes"("saleId");

-- CreateIndex
CREATE INDEX "taxes_realtorId_idx" ON "taxes"("realtorId");

-- CreateIndex
CREATE INDEX "taxes_year_idx" ON "taxes"("year");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_points_saleId_key" ON "loyalty_points"("saleId");

-- CreateIndex
CREATE INDEX "loyalty_points_realtorId_idx" ON "loyalty_points"("realtorId");

-- CreateIndex
CREATE INDEX "loyalty_points_source_idx" ON "loyalty_points"("source");

-- CreateIndex
CREATE INDEX "rankings_period_idx" ON "rankings"("period");

-- CreateIndex
CREATE INDEX "rankings_rank_idx" ON "rankings"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_realtorId_period_periodStart_key" ON "rankings"("realtorId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "staff_rankings_period_idx" ON "staff_rankings"("period");

-- CreateIndex
CREATE INDEX "staff_rankings_rank_idx" ON "staff_rankings"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "staff_rankings_staffProfileId_period_periodStart_key" ON "staff_rankings"("staffProfileId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "client_rankings_period_idx" ON "client_rankings"("period");

-- CreateIndex
CREATE INDEX "client_rankings_rank_idx" ON "client_rankings"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "client_rankings_clientProfileId_period_periodStart_key" ON "client_rankings"("clientProfileId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "payments_saleId_idx" ON "payments"("saleId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "monthly_awards_userId_idx" ON "monthly_awards"("userId");

-- CreateIndex
CREATE INDEX "monthly_awards_type_idx" ON "monthly_awards"("type");

-- CreateIndex
CREATE INDEX "monthly_awards_isPublished_idx" ON "monthly_awards"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_awards_type_month_year_key" ON "monthly_awards"("type", "month", "year");

-- CreateIndex
CREATE INDEX "offers_propertyId_idx" ON "offers"("propertyId");

-- CreateIndex
CREATE INDEX "offers_buyerId_idx" ON "offers"("buyerId");

-- CreateIndex
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- CreateIndex
CREATE INDEX "messages_roomId_idx" ON "messages"("roomId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "documents_propertyId_idx" ON "documents"("propertyId");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceId_key" ON "transactions"("referenceId");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_fromUserId_idx" ON "transactions"("fromUserId");

-- CreateIndex
CREATE INDEX "transactions_toUserId_idx" ON "transactions"("toUserId");

-- CreateIndex
CREATE INDEX "price_history_propertyId_idx" ON "price_history"("propertyId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_headId_key" ON "departments"("headId");

-- CreateIndex
CREATE INDEX "departments_parentId_idx" ON "departments"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_employeeId_key" ON "staff_profiles"("employeeId");

-- CreateIndex
CREATE INDEX "staff_profiles_departmentId_idx" ON "staff_profiles"("departmentId");

-- CreateIndex
CREATE INDEX "staff_profiles_managerId_idx" ON "staff_profiles"("managerId");

-- CreateIndex
CREATE INDEX "staff_profiles_employeeId_idx" ON "staff_profiles"("employeeId");

-- CreateIndex
CREATE INDEX "staff_permissions_staffProfileId_idx" ON "staff_permissions"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_permissions_staffProfileId_resource_action_key" ON "staff_permissions"("staffProfileId", "resource", "action");

-- CreateIndex
CREATE INDEX "attendance_staffProfileId_idx" ON "attendance"("staffProfileId");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE INDEX "attendance_status_idx" ON "attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_staffProfileId_date_key" ON "attendance"("staffProfileId", "date");

-- CreateIndex
CREATE INDEX "leave_requests_staffProfileId_idx" ON "leave_requests"("staffProfileId");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_startDate_idx" ON "leave_requests"("startDate");

-- CreateIndex
CREATE INDEX "performance_reviews_revieweeId_idx" ON "performance_reviews"("revieweeId");

-- CreateIndex
CREATE INDEX "performance_reviews_reviewerId_idx" ON "performance_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "performance_reviews_status_idx" ON "performance_reviews"("status");

-- CreateIndex
CREATE INDEX "payroll_records_staffProfileId_idx" ON "payroll_records"("staffProfileId");

-- CreateIndex
CREATE INDEX "payroll_records_status_idx" ON "payroll_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_staffProfileId_periodStart_periodEnd_key" ON "payroll_records"("staffProfileId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "staff_tasks_assigneeId_idx" ON "staff_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "staff_tasks_creatorId_idx" ON "staff_tasks"("creatorId");

-- CreateIndex
CREATE INDEX "staff_tasks_status_idx" ON "staff_tasks"("status");

-- CreateIndex
CREATE INDEX "staff_tasks_dueDate_idx" ON "staff_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE INDEX "team_channels_departmentId_idx" ON "team_channels"("departmentId");

-- CreateIndex
CREATE INDEX "team_channels_type_idx" ON "team_channels"("type");

-- CreateIndex
CREATE INDEX "channel_members_channelId_idx" ON "channel_members"("channelId");

-- CreateIndex
CREATE INDEX "channel_members_staffProfileId_idx" ON "channel_members"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channelId_staffProfileId_key" ON "channel_members"("channelId", "staffProfileId");

-- CreateIndex
CREATE INDEX "channel_messages_channelId_idx" ON "channel_messages"("channelId");

-- CreateIndex
CREATE INDEX "channel_messages_senderId_idx" ON "channel_messages"("senderId");

-- CreateIndex
CREATE INDEX "channel_messages_parentId_idx" ON "channel_messages"("parentId");

-- CreateIndex
CREATE INDEX "mentions_staffProfileId_idx" ON "mentions"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "mentions_messageId_staffProfileId_key" ON "mentions"("messageId", "staffProfileId");

-- CreateIndex
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key" ON "message_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "shared_files_uploadedById_idx" ON "shared_files"("uploadedById");

-- CreateIndex
CREATE INDEX "shared_files_channelId_idx" ON "shared_files"("channelId");

-- CreateIndex
CREATE INDEX "shared_files_departmentId_idx" ON "shared_files"("departmentId");

-- CreateIndex
CREATE INDEX "hr_policies_type_idx" ON "hr_policies"("type");

-- CreateIndex
CREATE INDEX "hr_policies_isActive_idx" ON "hr_policies"("isActive");

-- CreateIndex
CREATE INDEX "penalty_records_staffProfileId_idx" ON "penalty_records"("staffProfileId");

-- CreateIndex
CREATE INDEX "penalty_records_policyId_idx" ON "penalty_records"("policyId");

-- CreateIndex
CREATE INDEX "penalty_records_type_idx" ON "penalty_records"("type");

-- CreateIndex
CREATE INDEX "penalty_records_isApplied_idx" ON "penalty_records"("isApplied");

-- CreateIndex
CREATE INDEX "allowance_configs_type_idx" ON "allowance_configs"("type");

-- CreateIndex
CREATE INDEX "allowance_configs_isActive_idx" ON "allowance_configs"("isActive");

-- CreateIndex
CREATE INDEX "deduction_configs_type_idx" ON "deduction_configs"("type");

-- CreateIndex
CREATE INDEX "deduction_configs_isActive_idx" ON "deduction_configs"("isActive");

-- CreateIndex
CREATE INDEX "salary_structures_isActive_idx" ON "salary_structures"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_position_key" ON "salary_structures"("position");

-- CreateIndex
CREATE INDEX "gallery_items_type_idx" ON "gallery_items"("type");

-- CreateIndex
CREATE INDEX "gallery_items_isPublished_idx" ON "gallery_items"("isPublished");

-- CreateIndex
CREATE INDEX "gallery_items_order_idx" ON "gallery_items"("order");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_fcmToken_key" ON "user_devices"("fcmToken");

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_slug_idx" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_type_idx" ON "cms_pages"("type");

-- CreateIndex
CREATE INDEX "cms_pages_isPublished_idx" ON "cms_pages"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeToken_key" ON "newsletter_subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_isActive_idx" ON "newsletter_subscribers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "email_subscribers_unsubscribeToken_key" ON "email_subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "email_subscribers_tenantId_idx" ON "email_subscribers"("tenantId");

-- CreateIndex
CREATE INDEX "email_subscribers_email_idx" ON "email_subscribers"("email");

-- CreateIndex
CREATE INDEX "email_subscribers_role_idx" ON "email_subscribers"("role");

-- CreateIndex
CREATE INDEX "email_subscribers_isSubscribed_idx" ON "email_subscribers"("isSubscribed");

-- CreateIndex
CREATE INDEX "email_subscribers_dateOfBirth_idx" ON "email_subscribers"("dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "email_subscribers_tenantId_email_key" ON "email_subscribers"("tenantId", "email");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns"("tenantId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_campaignType_idx" ON "campaigns"("campaignType");

-- CreateIndex
CREATE INDEX "campaigns_scheduleType_idx" ON "campaigns"("scheduleType");

-- CreateIndex
CREATE INDEX "campaigns_scheduledAt_idx" ON "campaigns"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_logs_idempotencyKey_key" ON "campaign_logs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "campaign_logs_campaignId_idx" ON "campaign_logs"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_logs_subscriberId_idx" ON "campaign_logs"("subscriberId");

-- CreateIndex
CREATE INDEX "campaign_logs_status_idx" ON "campaign_logs"("status");

-- CreateIndex
CREATE INDEX "campaign_logs_email_idx" ON "campaign_logs"("email");

-- CreateIndex
CREATE INDEX "ai_content_templates_tenantId_idx" ON "ai_content_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_content_templates_tenantId_templateName_key" ON "ai_content_templates"("tenantId", "templateName");

-- CreateIndex
CREATE INDEX "popup_notifications_tenantId_idx" ON "popup_notifications"("tenantId");

-- CreateIndex
CREATE INDEX "popup_notifications_isActive_idx" ON "popup_notifications"("isActive");

-- CreateIndex
CREATE INDEX "popup_notifications_targetRole_idx" ON "popup_notifications"("targetRole");

-- CreateIndex
CREATE INDEX "popup_notifications_expiresAt_idx" ON "popup_notifications"("expiresAt");

-- CreateIndex
CREATE INDEX "engagement_posts_status_publishedAt_idx" ON "engagement_posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "engagement_posts_type_idx" ON "engagement_posts"("type");

-- CreateIndex
CREATE INDEX "engagement_posts_isPinned_idx" ON "engagement_posts"("isPinned");

-- CreateIndex
CREATE INDEX "engagement_posts_authorId_idx" ON "engagement_posts"("authorId");

-- CreateIndex
CREATE INDEX "post_reactions_postId_idx" ON "post_reactions"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_postId_userId_key" ON "post_reactions"("postId", "userId");

-- CreateIndex
CREATE INDEX "post_comments_postId_createdAt_idx" ON "post_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "post_comments_parentId_idx" ON "post_comments"("parentId");

-- CreateIndex
CREATE INDEX "post_views_postId_idx" ON "post_views"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_views_postId_userId_key" ON "post_views"("postId", "userId");

-- CreateIndex
CREATE INDEX "saved_posts_userId_idx" ON "saved_posts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_posts_postId_userId_key" ON "saved_posts"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "content_analytics_postId_key" ON "content_analytics"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "_ChatParticipants_AB_unique" ON "_ChatParticipants"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatParticipants_B_index" ON "_ChatParticipants"("B");

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtor_profiles" ADD CONSTRAINT "realtor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "client_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_rankings" ADD CONSTRAINT "staff_rankings_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rankings" ADD CONSTRAINT "client_rankings_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_awards" ADD CONSTRAINT "monthly_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headId_fkey" FOREIGN KEY ("headId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_channels" ADD CONSTRAINT "team_channels_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "channel_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_files" ADD CONSTRAINT "shared_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_files" ADD CONSTRAINT "shared_files_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "hr_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "email_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_posts" ADD CONSTRAINT "engagement_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "engagement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "engagement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_postId_fkey" FOREIGN KEY ("postId") REFERENCES "engagement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "engagement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_analytics" ADD CONSTRAINT "content_analytics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "engagement_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatParticipants" ADD CONSTRAINT "_ChatParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatParticipants" ADD CONSTRAINT "_ChatParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- SCHEMA MIGRATIONS — safe to run on both new and existing tenants.
-- New tenants: these are no-ops (columns already exist from CREATE TABLE above).
-- Existing tenants: these add new columns and enum values.
-- ============================================================

-- Add HR role to UserRole enum (PG12+ supports IF NOT EXISTS in transactions)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HR';

-- Add department role and module permissions (added 2026-02)
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "allowedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Make zipcode optional on properties (added 2026-02)
ALTER TABLE "properties" ALTER COLUMN "zipCode" DROP NOT NULL;

-- ============================================================
-- RBAC Roles system (added 2026-02-22)
-- ============================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS "roles" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");
CREATE INDEX IF NOT EXISTS "roles_name_idx" ON "roles"("name");

-- Add roleId to staff_profiles
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
CREATE INDEX IF NOT EXISTS "staff_profiles_roleId_idx" ON "staff_profiles"("roleId");

-- Foreign key from staff_profiles to roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_profiles_roleId_fkey'
  ) THEN
    ALTER TABLE "staff_profiles"
      ADD CONSTRAINT "staff_profiles_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "roles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
