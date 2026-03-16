export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function getDateRange(
  period: DashboardPeriod,
  month?: number,
  year?: number,
): { startDate: Date; endDate: Date } {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();

  switch (period) {
    case 'daily': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: start, endDate: now };
    }
    case 'weekly': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday as start
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    }
    case 'monthly': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'yearly': {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
  }
}

interface SaleRecord {
  saleDate: Date;
  salePrice: any;
  totalPaid?: any;
  paymentPlan?: any;
  commissionAmount: any;
}

export interface LedgerEntry { entryDate: Date; amount: any; }

/**
 * Build chart buckets with:
 *   - sale COUNT from Sale table (by saleDate — correct for "deals closed")
 *   - revenue from general_ledger entries (by entryDate — correct cash-basis)
 */
export function groupSalesIntoChartBuckets(
  sales: SaleRecord[],
  period: DashboardPeriod,
  startDate: Date,
  endDate: Date,
  ledgerEntries: LedgerEntry[] = [],
): { label: string; revenue: number; sales: number }[] {
  switch (period) {
    case 'daily':
      return groupByHour(sales, startDate, ledgerEntries);
    case 'weekly':
      return groupByDay(sales, startDate, endDate, ledgerEntries);
    case 'monthly':
      return groupByWeek(sales, startDate, endDate, ledgerEntries);
    case 'yearly':
      return groupByMonth(sales, startDate, ledgerEntries);
  }
}

function groupByHour(sales: SaleRecord[], startDate: Date, ledger: LedgerEntry[]) {
  const buckets: { label: string; revenue: number; sales: number }[] = [];
  for (let h = 0; h < 24; h++) {
    buckets.push({ label: `${h.toString().padStart(2, '0')}:00`, revenue: 0, sales: 0 });
  }
  for (const s of sales) {
    const d = new Date(s.saleDate);
    if (d >= startDate) buckets[d.getHours()].sales += 1;
  }
  for (const e of ledger) {
    const d = new Date(e.entryDate);
    if (d >= startDate) buckets[d.getHours()].revenue += Number(e.amount) || 0;
  }
  return buckets;
}

function groupByDay(sales: SaleRecord[], startDate: Date, endDate: Date, ledger: LedgerEntry[]) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const buckets = days.map((d) => ({ label: d, revenue: 0, sales: 0 }));
  for (const s of sales) {
    const d = new Date(s.saleDate);
    if (d >= startDate && d <= endDate) {
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      buckets[idx].sales += 1;
    }
  }
  for (const e of ledger) {
    const d = new Date(e.entryDate);
    if (d >= startDate && d <= endDate) {
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      buckets[idx].revenue += Number(e.amount) || 0;
    }
  }
  return buckets;
}

function groupByWeek(sales: SaleRecord[], startDate: Date, endDate: Date, ledger: LedgerEntry[]) {
  const buckets: { label: string; revenue: number; sales: number }[] = [];
  const start = new Date(startDate);
  let weekNum = 1;
  while (start <= endDate) {
    buckets.push({ label: `Week ${weekNum}`, revenue: 0, sales: 0 });
    weekNum++;
    start.setDate(start.getDate() + 7);
  }
  for (const s of sales) {
    const d = new Date(s.saleDate);
    if (d >= startDate && d <= endDate) {
      const idx = Math.floor((d.getTime() - startDate.getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < buckets.length) buckets[idx].sales += 1;
    }
  }
  for (const e of ledger) {
    const d = new Date(e.entryDate);
    if (d >= startDate && d <= endDate) {
      const idx = Math.floor((d.getTime() - startDate.getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < buckets.length) buckets[idx].revenue += Number(e.amount) || 0;
    }
  }
  return buckets;
}

function groupByMonth(sales: SaleRecord[], startDate: Date, ledger: LedgerEntry[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = startDate.getFullYear();
  const buckets = months.map((m) => ({ label: m, revenue: 0, sales: 0 }));
  for (const s of sales) {
    const d = new Date(s.saleDate);
    if (d.getFullYear() === year) buckets[d.getMonth()].sales += 1;
  }
  for (const e of ledger) {
    const d = new Date(e.entryDate);
    if (d.getFullYear() === year) buckets[d.getMonth()].revenue += Number(e.amount) || 0;
  }
  return buckets;
}
