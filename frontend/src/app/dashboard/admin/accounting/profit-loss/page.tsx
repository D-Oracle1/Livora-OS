'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Download, FileSpreadsheet, Loader2, RefreshCw, Table } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (period) {
    case 'this_month':
      return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { start: fmt(new Date(y, q * 3, 1)), end: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    case 'this_year':
      return { start: fmt(new Date(y, 0, 1)), end: fmt(new Date(y, 11, 31)) };
    default:
      return { start: fmt(new Date(y, 0, 1)), end: fmt(now) };
  }
}

export default function ProfitLossPage() {
  const branding = useBranding();
  const reportRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod] = useState<Period>('this_year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const range = period === 'custom'
        ? { start: customStart, end: customEnd }
        : getDateRange(period);
      if (!range.start || !range.end) return toast.error('Select a valid date range');
      const raw = await api.get<any>(`/accounting/profit-loss?startDate=${range.start}&endDate=${range.end}`);
      setData(raw?.data ?? raw);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => { if (period !== 'custom') fetchReport(); }, [period]);

  // ─── Print ────────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (!reportRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return toast.error('Allow popups to print');
    win.document.write(`<!DOCTYPE html><html><head><title>Profit & Loss Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .row.sub { padding-left: 16px; color: #4b5563; }
        .row.total { font-weight: 700; border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; font-size: 15px; }
        .row.profit { font-weight: 700; font-size: 16px; color: #059669; background: #f0fdf4; padding: 12px 8px; border-radius: 4px; margin-top: 16px; }
        .row.loss { color: #dc2626; background: #fef2f2; }
        .meta { text-align: right; font-size: 11px; color: #6b7280; margin-bottom: 24px; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      ${reportRef.current.innerHTML}
    </body></html>`);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  };

  // ─── PDF Export ───────────────────────────────────────────────────────────────

  const handlePdf = async () => {
    if (!reportRef.current || !data) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`profit-loss-${data.period?.startDate?.slice(0, 10)}-to-${data.period?.endDate?.slice(0, 10)}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  // ─── CSV Export ───────────────────────────────────────────────────────────────

  // ─── Excel Export ─────────────────────────────────────────────────────────────

  const handleExcel = async () => {
    if (!data) return;
    try {
      const XLSX = (await import('xlsx')).default;
      const rows: any[][] = [
        ['Profit & Loss Report'],
        ['Company', branding.companyName ?? 'Company'],
        ['Period', `${data.period?.startDate?.slice(0, 10)} to ${data.period?.endDate?.slice(0, 10)}`],
        ['Generated', new Date().toLocaleDateString()],
        [],
        ['INCOME'],
        ['Property Sales Revenue', data.revenue?.propertySales ?? 0],
        ['Total Revenue', data.revenue?.total ?? 0],
        [],
        ['DEDUCTIONS'],
        ['Commissions Paid', data.deductions?.commissions ?? 0],
        ['Taxes', data.deductions?.taxes ?? 0],
        ['Total Deductions', data.deductions?.total ?? 0],
        [],
        ['GROSS PROFIT', data.grossProfit ?? 0],
        [],
        ['EXPENSES'],
        ...(data.expenses?.byCategory ?? []).map((c: any) => [c.categoryName, c.total]),
        ['Total Expenses', data.expenses?.total ?? 0],
        [],
        ['NET PROFIT', data.netProfit ?? 0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
      XLSX.writeFile(wb, `profit-loss-${data.period?.startDate?.slice(0, 10)}-to-${data.period?.endDate?.slice(0, 10)}.xlsx`);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to generate Excel');
    }
  };

  const handleCsv = () => {
    if (!data) return;
    const rows: string[][] = [
      ['Profit & Loss Report'],
      ['Company', branding.companyName ?? 'Company'],
      ['Period', `${data.period?.startDate?.slice(0, 10)} to ${data.period?.endDate?.slice(0, 10)}`],
      ['Generated', new Date().toLocaleDateString()],
      [],
      ['INCOME'],
      ['Property Sales Revenue', String(data.revenue?.propertySales ?? 0)],
      ['Total Revenue', String(data.revenue?.total ?? 0)],
      [],
      ['DEDUCTIONS'],
      ['Commissions Paid', String(data.deductions?.commissions ?? 0)],
      ['Taxes', String(data.deductions?.taxes ?? 0)],
      ['Total Deductions', String(data.deductions?.total ?? 0)],
      [],
      ['GROSS PROFIT', String(data.grossProfit ?? 0)],
      [],
      ['EXPENSES'],
      ...(data.expenses?.byCategory ?? []).map((c: any) => [c.categoryName, String(c.total)]),
      ['Total Expenses', String(data.expenses?.total ?? 0)],
      [],
      ['NET PROFIT', String(data.netProfit ?? 0)],
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `profit-loss.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const PERIODS: { value: Period; label: string }[] = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const netPositive = (data?.netProfit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
          <p className="text-sm text-gray-500 mt-1">Dynamic financial report from real transaction data</p>
        </div>
        {data && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePdf}>
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
              <Table className="w-4 h-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCsv}>
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </Button>
          </div>
        )}
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Date</label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">End Date</label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
              </div>
              <Button onClick={fetchReport} className="mt-5" disabled={!customStart || !customEnd || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : data ? (
        <Card>
          <CardContent className="p-6 md:p-10">
            {/* Printable content */}
            <div ref={reportRef} className="max-w-2xl mx-auto">
              {/* Branded Header */}
              <div className="text-center mb-8 pb-6 border-b-2 border-gray-900">
                {branding.logo && (
                  <img src={branding.logo} alt={branding.companyName} className="h-12 mx-auto mb-3 object-contain" />
                )}
                <h1 className="text-2xl font-bold text-gray-900">{branding.companyName ?? 'Company'}</h1>
                <h2 className="text-lg font-semibold text-gray-600 mt-1">Profit & Loss Statement</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Period: {new Date(data.period.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '} — {' '}
                  {new Date(data.period.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p>
              </div>

              {/* Income — cash basis */}
              <section className="mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Income</h3>
                <p className="text-xs text-gray-400 mb-3">Cash basis — revenue recognised when cash is received</p>
                {(data.revenue?.fullPaymentSales ?? 0) > 0 && (
                  <PLRow label={`Full Payment Sales (${data.revenue?.fullSalesCount ?? 0})`} value={data.revenue?.fullPaymentSales ?? 0} indent />
                )}
                {(data.revenue?.installmentPayments ?? 0) > 0 && (
                  <PLRow label={`Instalment Payments Received (${data.revenue?.installmentPaymentsCount ?? 0})`} value={data.revenue?.installmentPayments ?? 0} indent />
                )}
                <PLDivider />
                <PLRow label="Total Revenue" value={data.revenue?.total ?? 0} bold />
              </section>

              {/* Deductions */}
              <section className="mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions</h3>
                <PLRow label={`Commissions Paid (${data.deductions?.commissionsCount ?? 0})`} value={-(data.deductions?.commissions ?? 0)} indent negative />
                <PLRow label="Taxes" value={-(data.deductions?.taxes ?? 0)} indent negative />
                <PLDivider />
                <PLRow label="Total Deductions" value={-(data.deductions?.total ?? 0)} bold negative />
              </section>

              {/* Gross Profit */}
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg mb-6">
                <span className="font-bold text-gray-900">Gross Profit</span>
                <span className={`font-bold text-lg ${(data.grossProfit ?? 0) >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {formatCurrency(data.grossProfit ?? 0)}
                </span>
              </div>

              {/* Expenses */}
              <section className="mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Operating Expenses</h3>
                {(data.expenses?.byCategory ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No approved expenses in this period</p>
                ) : (
                  (data.expenses?.byCategory ?? []).map((cat: any) => (
                    <PLRow key={cat.categoryId} label={`${cat.categoryName} (${cat.count})`} value={-cat.total} indent negative />
                  ))
                )}
                <PLDivider />
                <PLRow label={`Total Expenses (${data.expenses?.count ?? 0})`} value={-(data.expenses?.total ?? 0)} bold negative />
              </section>

              {/* Net Profit */}
              <div className={`flex justify-between items-center py-4 px-5 rounded-xl border-2 ${
                netPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}>
                <span className="font-extrabold text-gray-900 text-lg">NET {netPositive ? 'PROFIT' : 'LOSS'}</span>
                <span className={`font-extrabold text-2xl ${netPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(data.netProfit ?? 0))}
                </span>
              </div>

              {/* Revenue Detail — cash basis: full sales + installment payments */}
              {(data.salesDetail ?? []).length > 0 && (
                <section className="mt-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Revenue Detail ({data.salesDetail.length} transactions)
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Cash basis — full sales and installment payments received in period</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Property</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Realtor</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Commission</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.salesDetail.map((s: any) => (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-500">{new Date(s.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                s.type === 'INSTALLMENT_PAYMENT'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {s.type === 'INSTALLMENT_PAYMENT' ? 'Instalment' : 'Full Sale'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-700 max-w-[130px] truncate">{s.property}</td>
                            <td className="px-3 py-2 text-gray-600">{s.realtor}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.salePrice)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{formatCurrency(s.commission)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{formatCurrency(s.tax)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PLRow({ label, value, indent = false, bold = false, negative = false, note = false }: {
  label: string; value: number | null; indent?: boolean; bold?: boolean; negative?: boolean; note?: boolean;
}) {
  if (note) return <p className={`text-xs text-gray-400 ${indent ? 'pl-4' : ''} pb-1`}>{label}</p>;
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${bold ? 'border-t border-gray-200 mt-1 pt-3' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      {value !== null && (
        <span className={`text-sm ${bold ? 'font-bold text-gray-900' : ''} ${negative && value < 0 ? 'text-red-600' : value !== null && value >= 0 ? 'text-gray-900' : ''}`}>
          {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
        </span>
      )}
    </div>
  );
}

function PLDivider() {
  return <div className="border-t border-gray-200 my-1" />;
}
