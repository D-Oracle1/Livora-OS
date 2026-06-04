'use client';

import { forwardRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface ReceiptData {
  type: 'sale' | 'commission' | 'tax' | 'offer';
  receiptNumber: string;
  date: string;
  // Parties
  seller?: { name: string; email?: string; phone?: string; address?: string };
  buyer?: { name: string; email?: string; phone?: string; address?: string };
  // Property Details
  property?: { name: string; type: string; address: string };
  // Legal description text (auto-generated if not provided)
  description?: string;
  // Contact person / realtor name
  realtorName?: string;
  // Items
  items: { description: string; quantity?: number; unitPrice?: number; amount: number }[];
  // Summary
  subtotal: number;
  fees?: { label: string; amount: number }[];
  total: number;
  // Status
  status: 'paid' | 'pending' | 'completed' | 'cancelled';
  // Payment history (installment sales)
  paymentHistory?: {
    number: number;
    amount: number;
    date: string;
    method?: string;
    reference?: string;
    commission?: number;
    tax?: number;
  }[];
  totalPaid?: number;
  remainingBalance?: number;
  notes?: string;
}

interface ReceiptProps {
  data: ReceiptData;
  className?: string;
  branding?: {
    // Platform / general branding (fallbacks)
    companyName?: string;
    logo?: string;
    // Receipt-specific branding — architecturally separate
    receiptCompanyName?: string;   // overrides companyName on receipt
    receiptHeaderLogo?: string;    // top-left receipt logo (separate from platform logo)
    receiptWatermarkLogo?: string; // watermark (falls back to receiptHeaderLogo then logo)
    watermarkOpacity?: number;     // 0–10, default 4
    signatureImage?: string;
    receiptLogo?: string;          // bottom-right footer logo
    // Contact / payment
    rcNumber?: string;
    supportEmail?: string;
    supportPhone?: string;
    address?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    paymentMethod?: string;
    signatoryName?: string;
    signatoryTitle?: string;
    // allow extra keys from BrandingData without conflicts
    [key: string]: unknown;
  };
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ data, className = '', branding }, ref) => {
    // ── Architectural separation: receipt branding vs platform branding ────────
    // receiptCompanyName overrides companyName; each falls back to the other.
    const brandName = branding?.receiptCompanyName || branding?.companyName || 'Livora OS';
    // receiptHeaderLogo is the dedicated top-left receipt logo.
    // Falls back to general logo only if no receipt-specific logo is configured.
    const headerLogoSrc = branding?.receiptHeaderLogo || branding?.logo || null;
    // Watermark uses its own field, then receipt header logo, then general logo.
    const watermarkSrc = branding?.receiptWatermarkLogo || branding?.receiptHeaderLogo || branding?.logo || null;
    // Watermark opacity stored as integer 0–10 (e.g. 4 = 4%). Default 4%.
    const watermarkOpacity = ((branding?.watermarkOpacity ?? 4) / 100);
    // Footer logo: dedicated receiptLogo > general logo > static fallback
    const footerLogoSrc = branding?.receiptLogo || branding?.logo || '/receipt-logo.jpg';

    const firstItem = data.items[0];
    const quantity = firstItem?.quantity ?? 1;
    const unitPrice =
      firstItem?.unitPrice ??
      (quantity > 0 ? data.total / quantity : data.total);

    // ── helpers ──────────────────────────────────────────────────────────────
    const getReceiptTitle = (type: string) => {
      switch (type) {
        case 'sale':       return 'PURCHASE RECEIPT';
        case 'commission': return 'COMMISSION RECEIPT';
        case 'tax':        return 'TAX RECEIPT';
        case 'offer':      return 'OFFER RECEIPT';
        default:           return 'RECEIPT';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'paid':
        case 'completed': return 'APPROVED PURCHASE';
        case 'pending':   return 'PENDING APPROVAL';
        case 'cancelled': return 'CANCELLED';
        default:          return status.toUpperCase();
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'paid':
        case 'completed': return '#b91c1c';  // bold red
        case 'pending':   return '#d97706';  // amber
        case 'cancelled': return '#6b7280';  // gray
        default:          return '#1f2937';
      }
    };

    const getRemarks = (status: string) => {
      switch (status) {
        case 'paid':
        case 'completed': return 'COMPLETE';
        case 'pending':   return 'PENDING';
        case 'cancelled': return 'CANCELLED';
        default:          return status.toUpperCase();
      }
    };

    // Build legal description if not explicitly provided
    const legalDescription =
      data.description ||
      (data.property
        ? (() => { const isLand = (data.property.type || 'Land') === 'Land'; const unit = isLand ? (quantity === 1 ? 'plot' : 'plots') : (quantity === 1 ? 'unit' : 'units'); return `Purchase of ${quantity} ${unit} of ${data.property.type || 'Land'} lying and situate at ${data.property.name}${data.property.address ? `, ${data.property.address}` : ''}.`; })()
        : firstItem?.description || '');

    // Initials fallback when no header logo is configured
    const initials = brandName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);

    // ── render ───────────────────────────────────────────────────────────────
    return (
      <div
        ref={ref}
        className={className}
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          background: '#fff',
          color: '#111111',
          maxWidth: '794px',
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Watermark — uses dedicated watermarkSrc, independent of header logo */}
        {watermarkSrc && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: watermarkOpacity,
              zIndex: 0,
              width: '380px',
              pointerEvents: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={watermarkSrc} alt="" style={{ width: '100%', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1, padding: '40px 48px' }}>

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>

            {/* Left: logo + name + RC */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              {headerLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headerLogoSrc}
                  alt={brandName}
                  style={{ maxHeight: '70px', maxWidth: '120px', width: 'auto', height: 'auto', objectFit: 'contain', flexShrink: 0, display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '62px', height: '62px', borderRadius: '8px',
                  background: '#166534', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>{initials}</span>
                </div>
              )}
              <div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#111', letterSpacing: '0.04em', lineHeight: 1.15 }}>
                  {brandName.toUpperCase()}
                </div>
                {branding?.rcNumber && (
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    RC: {branding.rcNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Right: receipt type / number / date */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '17px', fontWeight: 900, color: '#111',
                textDecoration: 'underline', marginBottom: '10px',
                letterSpacing: '0.03em',
              }}>
                {getReceiptTitle(data.type)}
              </div>
              <div style={{ fontSize: '13px', color: '#333', marginBottom: '5px' }}>
                <span style={{ fontWeight: 700 }}>RECEIPT NO.</span>&nbsp;{data.receiptNumber}
              </div>
              <div style={{ fontSize: '13px', color: '#333' }}>
                <span style={{ fontWeight: 700 }}>Date:</span>&nbsp;{formatDate(data.date)}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderBottom: '2px solid #111', marginBottom: '22px' }} />

          {/* ── STATUS STAMP ── */}
          <div style={{ marginBottom: '22px' }}>
            <span style={{
              fontSize: '30px', fontWeight: 900,
              color: getStatusColor(data.status),
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {getStatusText(data.status)}
            </span>
          </div>

          {/* ── ISSUED TO ── */}
          {data.buyer && (
            <div style={{ marginBottom: '20px', lineHeight: '1.8' }}>
              <div style={{ fontSize: '13px' }}>
                <span style={{ fontWeight: 700, fontStyle: 'italic' }}>Issued To:&nbsp;</span>
                <span style={{ fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline' }}>{data.buyer.name}</span>
                <span style={{ fontWeight: 700, fontStyle: 'italic' }}>&nbsp;(PURCHASER).</span>
              </div>
              {data.buyer.address && (
                <div style={{ fontSize: '13px', fontWeight: 700, fontStyle: 'italic' }}>
                  ADDRESS: {data.buyer.address}
                </div>
              )}
              {data.buyer.email && (
                <div style={{ fontSize: '13px', fontWeight: 700, fontStyle: 'italic' }}>
                  EMAIL: {data.buyer.email}
                </div>
              )}
              {data.buyer.phone && (
                <div style={{ fontSize: '13px', fontWeight: 700, fontStyle: 'italic' }}>
                  PHONE NUMBER: {data.buyer.phone}
                </div>
              )}
            </div>
          )}

          {/* ── DESCRIPTION ── */}
          {legalDescription && (
            <div style={{
              marginBottom: '24px', fontSize: '13px',
              lineHeight: '1.65', textAlign: 'justify',
            }}>
              <span style={{ fontWeight: 700 }}>DESCRIPTION:&nbsp;</span>
              {legalDescription}
            </div>
          )}

          {/* ── ESTATE DETAILS BOX ── */}
          <div style={{
            background: '#f0f4f0', border: '1px solid #ccd5cc',
            borderRadius: '4px', padding: '16px 20px', marginBottom: '24px',
            lineHeight: '1.9',
          }}>
            {data.property && (
              <div style={{ fontSize: '13px' }}>
                <span style={{ fontWeight: 700 }}>ESTATE:&nbsp;</span>
                <span style={{ fontStyle: 'italic' }}>{data.property.name}</span>
              </div>
            )}
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>PLOT:&nbsp;</span>
              <span style={{ fontStyle: 'italic' }}>{quantity}</span>
            </div>
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>UNIT PRICE:&nbsp;</span>
              <span style={{ fontStyle: 'italic' }}>{formatCurrency(unitPrice)}</span>
            </div>
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>TOTAL:&nbsp;</span>
              <span style={{ fontStyle: 'italic' }}>{formatCurrency(data.total)}</span>
            </div>
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>REMARKS:&nbsp;</span>
              <span style={{ fontStyle: 'italic' }}>{getRemarks(data.status)}</span>
            </div>
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 700 }}>CONTACT PERSON:&nbsp;</span>
              <span style={{ fontStyle: 'italic' }}>{data.realtorName || '(REALTOR)'}</span>
            </div>
          </div>

          {/* ── PAYMENT INSTRUCTIONS ── */}
          <div style={{ marginBottom: '36px', lineHeight: '1.9' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
              Payment Instructions:
            </div>
            <div style={{ fontSize: '13px' }}>
              - <span style={{ fontWeight: 600 }}>Payment Method:</span>&nbsp;
              {branding?.paymentMethod || 'Bank Transfer.'}
            </div>
            {branding?.accountName && (
              <div style={{ fontSize: '13px' }}>
                - <span style={{ fontWeight: 600 }}>Account Name:</span>&nbsp;{branding.accountName}
              </div>
            )}
            {branding?.accountNumber && (
              <div style={{ fontSize: '13px' }}>
                - <span style={{ fontWeight: 600 }}>Account Number:</span>&nbsp;{branding.accountNumber}
              </div>
            )}
            {branding?.bankName && (
              <div style={{ fontSize: '13px' }}>
                - <span style={{ fontWeight: 600 }}>Bank Name:</span>&nbsp;{branding.bankName}
              </div>
            )}
            {!branding?.accountName && !branding?.accountNumber && !branding?.bankName && (
              <div style={{ fontSize: '12px', color: '#777', fontStyle: 'italic', marginTop: '2px' }}>
                Contact the company for bank account details.
              </div>
            )}
          </div>

          {/* ── PAYMENT HISTORY (installment sales) ── */}
          {data.paymentHistory && data.paymentHistory.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, marginBottom: '8px',
                textDecoration: 'underline',
              }}>
                Payment History
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #bbb' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Method</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 700 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paymentHistory.map((p) => (
                    <tr key={p.number} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 8px', color: '#555' }}>{p.number}</td>
                      <td style={{ padding: '4px 8px', color: '#555' }}>{formatDate(p.date)}</td>
                      <td style={{ padding: '4px 8px', color: '#555' }}>
                        {p.method?.replace(/_/g, ' ') || '—'}
                        {p.reference ? <span style={{ color: '#888', fontSize: '11px' }}> ({p.reference})</span> : ''}
                      </td>
                      <td style={{ padding: '4px 8px', color: '#111', fontWeight: 600, textAlign: 'right' }}>
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #bbb' }}>
                    <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700 }}>Total Paid</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>
                      {formatCurrency(
                        data.totalPaid ??
                        data.paymentHistory.reduce((s, p) => s + p.amount, 0),
                      )}
                    </td>
                  </tr>
                  {data.remainingBalance !== undefined && data.remainingBalance > 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '4px 8px', fontWeight: 700, color: '#d97706' }}>
                        Remaining Balance
                      </td>
                      <td style={{ padding: '4px 8px', fontWeight: 700, color: '#d97706', textAlign: 'right' }}>
                        {formatCurrency(data.remainingBalance)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          {/* ── NOTES ── */}
          {data.notes && (
            <div style={{
              marginBottom: '24px', padding: '12px 16px',
              background: '#f8f8f8', borderRadius: '4px',
              fontSize: '12px', color: '#555',
            }}>
              <span style={{ fontWeight: 600 }}>Notes:&nbsp;</span>{data.notes}
            </div>
          )}

          {/* ── SIGNATURE ── */}
          <div style={{ marginTop: '12px', marginBottom: '40px' }}>
            {/* Signature image sits directly above the underline.
                When present: underline has no height so there is zero gap.
                When absent: underline has 48px height to give space for a wet signature. */}
            {branding?.signatureImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.signatureImage}
                alt="Signature"
                style={{ maxHeight: '56px', maxWidth: '220px', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
              />
            )}
            <div style={{
              width: '220px',
              height: branding?.signatureImage ? '0' : '48px',
              borderBottom: '1px solid #333',
              marginBottom: '10px',
            }} />
            {branding?.signatoryName && (
              <div style={{ fontSize: '13px', fontWeight: 700, fontStyle: 'italic' }}>
                {branding.signatoryName}
              </div>
            )}
            {branding?.signatoryTitle && (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#333', marginTop: '2px' }}>
                {branding.signatoryTitle}
              </div>
            )}
            <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#444', marginTop: '4px' }}>
              (For the VENDOR)
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{
            borderTop: '1px solid #ccc', paddingTop: '16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          }}>
            {/* Contact info */}
            <div style={{ fontSize: '11px', color: '#444', lineHeight: '1.8' }}>
              {branding?.address && (
                <div>📍 {branding.address}</div>
              )}
              {branding?.supportPhone && (
                <div>📞 {branding.supportPhone}</div>
              )}
              {branding?.supportEmail && (
                <div>✉ {branding.supportEmail}</div>
              )}
            </div>

            {/* Footer logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={footerLogoSrc}
              alt={brandName}
              style={{ width: '90px', height: '90px', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

        </div>
      </div>
    );
  },
);

Receipt.displayName = 'Receipt';
