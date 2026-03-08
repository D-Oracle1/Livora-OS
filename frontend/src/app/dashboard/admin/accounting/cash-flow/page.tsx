'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Download, FileSpreadsheet, Loader2, RefreshCw, Waves, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (period) {
    case 'this_month':   return { start: fmt(new Date(y, m, 1)),       end: fmt(new Date(y, m + 1, 0)) };
    case 'last_month':   return { start: fmt(new Date(y, m - 1, 1)),   end: fmt(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { start: fmt(new Date(y, q * 3, 1)), end: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    case 'this_year':    return { start: fmt(new Date(y, 0, 1)),        end: fmt(new Date(y, 11, 31)) };
    default:             return { start: fmt(new Date(y, 0, 1)),        end: fmt(now) };
  }
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year',    label: 'This Year' },
  { value: 'custom',       label: 'Custom Range' },
];

export default function CashFlowPage() {
  const branding = useBranding();
  const reportRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod]         = useState<Period>('this_year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const range = period === 'custom'
        ? { start: customStart, end: customEnd }
        : getDateRange(period);
      if (!range.start || !range.end) return toast.error('Select a valid date range');
      const raw = await api.get<any>(`/accounting/cash-flow?startDate=${range.start}&endDate=${range.end}`);
      setData(raw?.data ?? raw);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load cash flow statement');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => { if (period !== 'custom') fetchReport(); }, [period]);  // eslint-disable-line

  // ─── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!reportRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return toast.error('Allow popups to print');
    win.document.write(`<!DOCTYPE html><html><head><title>Cash Flow Statement</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
        h1 { font-size: 20px; } h2 { font-size: 15px; color: #4b5563; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 20px 0 8px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .row.indent { padding-left: 16px; color: #4b5563; }
        .row.total { font-weight: 700; border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; }
        .net-box { padding: 14px 16px; border-radius: 6px; display: flex; justify-content: space-between; font-weight: 700; font-size: 16px; margin-top: 20px; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      ${reportRef.current.innerHTML}
    </body></html>`);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  };

  // ─── PDF Export ──────────────────────────────────────────────────────────────
  const handlePdf = async () => {
    if (!reportRef.current || !data) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 297));
      const range = period === 'custom' ? { start: customStart, end: customEnd } : getDateRange(period);
      pdf.save(`cash-flow-${range.start}-to-${range.end}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  // ─── Excel Export ─────────────────────────────────────────────────────────────
  const handleExcel = async () => {
    if (!data) return;
    try {
      const XLSX = (await import('xlsx')).default;
      const range = period === 'custom' ? { start: customStart, end: customEnd } : getDateRange(period);
      const rows = [
        ['Cash Flow Statement'],
        ['Company', branding.companyName ?? ''],
        ['Period', `${range.start} to ${range.end}`],
        ['Generated', new Date().toLocaleString()],
        [],
        ['CASH INFLOWS'],
        ['Full Payment Sales', data.inflows?.fullPaymentSales?.total ?? 0],
        ['Installment Payments Received', data.inflows?.installmentPayments?.total ?? 0],
        ['TOTAL INFLOWS', data.inflows?.total ?? 0],
        [],
        ['CASH OUTFLOWS'],
        ['Commissions Paid', data.outflows?.commissions?.total ?? 0],
        ['Approved Expenses', data.outflows?.expenses?.total ?? 0],
        ['Taxes', data.outflows?.taxes?.total ?? 0],
        ['TOTAL OUTFLOWS', data.outflows?.total ?? 0],
        [],
        ['NET CASH FLOW', data.netCashFlow ?? 0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');
      XLSX.writeFile(wb, `cash-flow-${range.start}-to-${range.end}.xlsx`);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to generate Excel');
    }
  };

  const netPositive = (data?.netCashFlow ?? 0) >= 0;

  // Chart data for visual comparison
  const chartData = data ? [
    { name: 'Full Payment Sales', value: data.inflows?.fullPaymentSales?.total ?? 0, type: 'inflow' },
    { name: 'Installment Payments', value: data.inflows?.installmentPayments?.total ?? 0, type: 'inflow' },
    { name: 'Commissions Paid', value: data.outflows?.commissions?.total ?? 0, type: 'outflow' },
    { name: 'Expenses', value: data.outflows?.expenses?.total ?? 0, type: 'outflow' },
    { name: 'Taxes', value: data.outflows?.taxes?.total ?? 0, type: 'outflow' },
  ].filter((d) => d.value > 0) : [];

  const summaryChart = data ? [
    { name: 'Inflows', value: data.inflows?.total ?? 0 },
    { name: 'Outflows', value: data.outflows?.total ?? 0 },
    { name: 'Net Cash', value: Math.abs(data.netCashFlow ?? 0) },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Waves className="w-6 h-6 text-blue-600" /> Cash Flow Statement
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track how money flows in and out of the business</p>
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
              <FileSpreadsheet className="w-4 h-4" /> Excel
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
            <div className="flex items-end gap-3 mt-4 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Date</label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">End Date</label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
              </div>
              <Button onClick={fetchReport} disabled={!customStart || !customEnd || loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-700 font-medium">Total Inflows</p>
                    <p className="text-xl font-bold text-green-800">{formatCurrency(data.inflows?.total ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-red-700 font-medium">Total Outflows</p>
                    <p className="text-xl font-bold text-red-800">{formatCurrency(data.outflows?.total ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={`${netPositive ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${netPositive ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    <Waves className={`w-5 h-5 ${netPositive ? 'text-blue-600' : 'text-orange-600'}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${netPositive ? 'text-blue-700' : 'text-orange-700'}`}>
                      Net Cash Flow
                    </p>
                    <p className={`text-xl font-bold ${netPositive ? 'text-blue-800' : 'text-orange-800'}`}>
                      {netPositive ? '+' : '-'}{formatCurrency(Math.abs(data.netCashFlow ?? 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {summaryChart.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-gray-700 mb-4">Cash Flow Comparison</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={summaryChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {summaryChart.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={index === 0 ? '#10b981' : index === 1 ? '#f87171' : netPositive ? '#6366f1' : '#f97316'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Statement */}
          <Card>
            <CardContent className="p-6 md:p-10">
              <div ref={reportRef} className="max-w-2xl mx-auto">
                {/* Branded Header */}
                <div className="text-center mb-8 pb-6 border-b-2 border-gray-900">
                  {branding.logo && (
                    <img src={branding.logo} alt={branding.companyName} className="h-12 mx-auto mb-3 object-contain" />
                  )}
                  <h1 className="text-2xl font-bold text-gray-900">{branding.companyName ?? 'Company'}</h1>
                  <h2 className="text-lg font-semibold text-gray-600 mt-1">Cash Flow Statement</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(data.period.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' — '}
                    {new Date(data.period.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p>
                </div>

                {/* INFLOWS */}
                <section className="mb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Cash Inflows</h3>
                  <CFRow
                    label={`Full Payment Sales (${data.inflows?.fullPaymentSales?.count ?? 0} transactions)`}
                    value={data.inflows?.fullPaymentSales?.total ?? 0}
                    positive indent
                  />
                  <CFRow
                    label={`Installment Payments Received (${data.inflows?.installmentPayments?.count ?? 0} payments)`}
                    value={data.inflows?.installmentPayments?.total ?? 0}
                    positive indent
                  />
                  <CFDivider />
                  <CFRow label="Total Cash Inflows" value={data.inflows?.total ?? 0} bold positive />
                </section>

                {/* OUTFLOWS */}
                <section className="mb-6">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Cash Outflows</h3>
                  <CFRow
                    label={`Commissions Paid (${data.outflows?.commissions?.count ?? 0} paid)`}
                    value={data.outflows?.commissions?.total ?? 0}
                    negative indent
                  />
                  <CFRow
                    label={`Operating Expenses (${data.outflows?.expenses?.count ?? 0} expenses)`}
                    value={data.outflows?.expenses?.total ?? 0}
                    negative indent
                  />
                  <CFRow label="Taxes" value={data.outflows?.taxes?.total ?? 0} negative indent />
                  <CFDivider />
                  <CFRow label="Total Cash Outflows" value={data.outflows?.total ?? 0} bold negative />
                </section>

                {/* Net Cash Flow */}
                <div className={`flex justify-between items-center py-4 px-5 rounded-xl border-2 ${
                  netPositive ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <div>
                    <p className="font-extrabold text-gray-900 text-lg">
                      NET {netPositive ? 'POSITIVE' : 'NEGATIVE'} CASH FLOW
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Inflows − Total Outflows</p>
                  </div>
                  <span className={`font-extrabold text-2xl ${netPositive ? 'text-blue-700' : 'text-orange-700'}`}>
                    {netPositive ? '+' : '-'}{formatCurrency(Math.abs(data.netCashFlow ?? 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function CFRow({ label, value, indent = false, bold = false, positive = false, negative = false }: {
  label: string; value: number; indent?: boolean; bold?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${
      bold ? 'border-t border-gray-200 mt-1 pt-3' : 'border-b border-gray-50'
    }`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${
        bold ? 'font-bold text-gray-900' : positive ? 'text-green-700' : negative ? 'text-red-700' : 'text-gray-700'
      }`}>
        {negative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
      </span>
    </div>
  );
}

function CFDivider() {
  return <div className="border-t border-gray-200 my-1" />;
}
