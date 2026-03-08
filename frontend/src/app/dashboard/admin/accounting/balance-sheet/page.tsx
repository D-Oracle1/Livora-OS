'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Download, FileSpreadsheet, Loader2, RefreshCw, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';

export default function BalanceSheetPage() {
  const branding = useBranding();
  const reportRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const [asOf, setAsOf] = useState(todayStr);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const raw = await api.get<any>(`/accounting/balance-sheet?asOf=${date}`);
      setData(raw?.data ?? raw);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(asOf); }, []);  // eslint-disable-line

  // ─── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!reportRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return toast.error('Allow popups to print');
    win.document.write(`<!DOCTYPE html><html><head><title>Balance Sheet</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 20px 0 8px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .row.indent { padding-left: 16px; }
        .row.sub { color: #6b7280; font-size: 12px; }
        .row.total { font-weight: 700; border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; }
        .box { padding: 12px 16px; border-radius: 6px; margin-top: 12px; display: flex; justify-content: space-between; font-weight: 700; }
        .equity-box { background: #f0f9ff; border: 2px solid #0ea5e9; color: #0369a1; }
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
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 297));
      pdf.save(`balance-sheet-${asOf}.pdf`);
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
      const rows = [
        ['Balance Sheet'],
        ['Company', branding.companyName ?? ''],
        ['As of', new Date(data.asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Generated', new Date().toLocaleString()],
        [],
        ['ASSETS'],
        ['Cash — Full payment sales', data.assets?.cash?.fromFullSales ?? 0],
        ['Cash — Installment payments received', data.assets?.cash?.fromInstallments ?? 0],
        ['Total Cash', data.assets?.cash?.total ?? 0],
        ['Accounts Receivable (outstanding)', data.assets?.receivables?.total ?? 0],
        ['TOTAL ASSETS', data.assets?.total ?? 0],
        [],
        ['LIABILITIES'],
        ['Unpaid Commissions', data.liabilities?.unpaidCommissions?.total ?? 0],
        ['Pending Expense Approvals', data.liabilities?.pendingExpenses?.total ?? 0],
        ['Tax Payable', data.liabilities?.taxPayable?.total ?? 0],
        ['TOTAL LIABILITIES', data.liabilities?.total ?? 0],
        [],
        ['EQUITY'],
        ["Owner's Equity (Assets − Liabilities)", data.equity ?? 0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
      XLSX.writeFile(wb, `balance-sheet-${asOf}.xlsx`);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to generate Excel');
    }
  };

  const equityPositive = (data?.equity ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" /> Balance Sheet
          </h1>
          <p className="text-sm text-gray-500 mt-1">Assets, liabilities and equity at a point in time</p>
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

      {/* Date Picker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Balance Sheet As of</label>
              <Input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-44"
                max={todayStr}
              />
            </div>
            <Button
              onClick={() => fetchReport(asOf)}
              disabled={!asOf || loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : data ? (
        <Card>
          <CardContent className="p-6 md:p-10">
            <div ref={reportRef} className="max-w-2xl mx-auto">
              {/* Branded Header */}
              <div className="text-center mb-8 pb-6 border-b-2 border-gray-900">
                {branding.logo && (
                  <img src={branding.logo} alt={branding.companyName} className="h-12 mx-auto mb-3 object-contain" />
                )}
                <h1 className="text-2xl font-bold text-gray-900">{branding.companyName ?? 'Company'}</h1>
                <h2 className="text-lg font-semibold text-gray-600 mt-1">Balance Sheet</h2>
                <p className="text-sm text-gray-500 mt-1">
                  As of {new Date(data.asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p>
              </div>

              {/* ASSETS */}
              <BSSection title="Assets">
                <BSSubheading label="Current Assets" />
                <BSRow label="Cash — Full Payment Sales" value={data.assets?.cash?.fromFullSales ?? 0} indent />
                <BSRow
                  label={`Cash — Installment Payments (${data.assets?.cash?.installmentPaymentsCount ?? 0} received)`}
                  value={data.assets?.cash?.fromInstallments ?? 0}
                  indent
                />
                <BSRow label="Total Cash" value={data.assets?.cash?.total ?? 0} bold />
                <BSSubheading label="Receivables" />
                <BSRow
                  label={`Accounts Receivable — ${data.assets?.receivables?.count ?? 0} active installment sale(s)`}
                  value={data.assets?.receivables?.total ?? 0}
                  indent
                />
                <BSDivider />
                <BSRow label="TOTAL ASSETS" value={data.assets?.total ?? 0} total />
              </BSSection>

              {/* LIABILITIES */}
              <BSSection title="Liabilities">
                <BSRow
                  label={`Unpaid Commissions (${data.liabilities?.unpaidCommissions?.count ?? 0} pending)`}
                  value={data.liabilities?.unpaidCommissions?.total ?? 0}
                  indent
                />
                <BSRow
                  label={`Pending Expense Approvals (${data.liabilities?.pendingExpenses?.count ?? 0})`}
                  value={data.liabilities?.pendingExpenses?.total ?? 0}
                  indent
                />
                <BSRow label="Tax Payable" value={data.liabilities?.taxPayable?.total ?? 0} indent />
                <BSDivider />
                <BSRow label="TOTAL LIABILITIES" value={data.liabilities?.total ?? 0} total />
              </BSSection>

              {/* EQUITY */}
              <div className={`flex justify-between items-center py-4 px-5 rounded-xl border-2 mt-6 ${
                equityPositive ? 'bg-sky-50 border-sky-200' : 'bg-red-50 border-red-200'
              }`}>
                <div>
                  <p className="font-extrabold text-gray-900 text-lg">
                    {equityPositive ? "Owner's Equity" : 'Net Deficit'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Assets − Liabilities</p>
                </div>
                <span className={`font-extrabold text-2xl ${equityPositive ? 'text-sky-700' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(data.equity ?? 0))}
                </span>
              </div>

              {/* Accounting Equation */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 text-center mb-2 font-medium">Accounting Equation Verification</p>
                <div className="flex items-center justify-center gap-4 text-sm font-semibold flex-wrap text-center">
                  <span className="text-green-700">Assets {formatCurrency(data.assets?.total ?? 0)}</span>
                  <span className="text-gray-400">=</span>
                  <span className="text-red-700">Liabilities {formatCurrency(data.liabilities?.total ?? 0)}</span>
                  <span className="text-gray-400">+</span>
                  <span className="text-sky-700">Equity {formatCurrency(data.equity ?? 0)}</span>
                </div>
                <p className={`text-xs text-center mt-2 ${
                  Math.abs((data.assets?.total ?? 0) - (data.liabilities?.total ?? 0) - (data.equity ?? 0)) < 1
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {Math.abs((data.assets?.total ?? 0) - (data.liabilities?.total ?? 0) - (data.equity ?? 0)) < 1
                    ? '✓ Equation balanced'
                    : '⚠ Equation imbalanced — check data'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BSSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  );
}

function BSSubheading({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1">{label}</p>;
}

function BSDivider() {
  return <div className="border-t border-gray-200 my-1" />;
}

function BSRow({ label, value, indent = false, bold = false, total = false }: {
  label: string; value: number; indent?: boolean; bold?: boolean; total?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${
      total ? 'border-t-2 border-gray-900 mt-1 pt-3' : bold ? 'border-t border-gray-200 mt-1 pt-2' : 'border-b border-gray-50'
    }`}>
      <span className={`text-sm ${total ? 'font-bold text-gray-900' : bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm ${total ? 'font-bold text-gray-900' : bold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
