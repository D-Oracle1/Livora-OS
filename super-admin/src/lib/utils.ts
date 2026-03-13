import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#E5E4E2',
  };
  return colors[tier] || colors.BRONZE;
}

export function getTierBgClass(tier: string): string {
  const classes: Record<string, string> = {
    BRONZE: 'bg-[#CD7F32]/10 text-[#CD7F32]',
    SILVER: 'bg-[#C0C0C0]/10 text-[#71717A]',
    GOLD: 'bg-[#FFD700]/10 text-[#B8860B]',
    PLATINUM: 'bg-[#E5E4E2]/10 text-[#6B7280]',
  };
  return classes[tier] || classes.BRONZE;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Area Unit Conversions ---

export type AreaUnit = 'sqm' | 'acre' | 'hectare' | 'plot';

export const AREA_UNITS: Record<AreaUnit, { label: string; factor: number; shortLabel: string }> = {
  sqm:     { label: 'Square Meters',  factor: 1,       shortLabel: 'sqm' },
  acre:    { label: 'Acres',          factor: 4046.86, shortLabel: 'acre(s)' },
  hectare: { label: 'Hectares',       factor: 10000,   shortLabel: 'ha' },
  plot:    { label: 'Plots (465 sqm)', factor: 465,    shortLabel: 'plot(s)' },
};

/** Convert from a given unit to sqm for database storage */
export function toSqm(value: number, unit: AreaUnit): number {
  return value * AREA_UNITS[unit].factor;
}

/** Convert from sqm (database) to a display unit */
export function fromSqm(sqmValue: number, unit: AreaUnit): number {
  return sqmValue / AREA_UNITS[unit].factor;
}

/** Format an area value (stored in sqm) with its unit label */
export function formatArea(sqmValue: number, unit: AreaUnit = 'sqm'): string {
  const converted = fromSqm(sqmValue, unit);
  const formatted = converted % 1 === 0 ? converted.toString() : converted.toFixed(2);
  return `${formatNumber(parseFloat(formatted))} ${AREA_UNITS[unit].shortLabel}`;
}

/** Convert price-per-sqm to price-per-unit for display */
export function pricePerUnit(pricePerSqm: number, unit: AreaUnit): number {
  return pricePerSqm * AREA_UNITS[unit].factor;
}

/** Convert price-per-unit (user input) back to price-per-sqm for storage */
export function toPricePerSqm(priceInUnit: number, unit: AreaUnit): number {
  return priceInUnit / AREA_UNITS[unit].factor;
}
