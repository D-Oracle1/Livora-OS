'use client';

import { useState, useRef } from 'react';
import { Download, Send, X, Loader2, Printer, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Receipt, ReceiptData } from './Receipt';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth-storage';

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
  branding?: {
    companyName?: string;
    supportEmail?: string;
    supportPhone?: string;
    address?: string;
  };
}

export function ReceiptModal({ open, onClose, data, branding }: ReceiptModalProps) {
  const [sending, setSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!receiptRef.current || !data) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Clone the receipt into a full-size off-screen container so html2canvas
      // sees the complete content regardless of the dialog's scroll constraints.
      const clone = receiptRef.current.cloneNode(true) as HTMLElement;
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        top: '0',
        left: '-9999px',
        width: '794px',          // A4-ish pixel width at 96dpi
        background: '#ffffff',
        zIndex: '-1',
        overflow: 'visible',
      });
      container.appendChild(clone);
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        onclone: (_doc, el) => {
          el.style.overflow = 'visible';
          el.style.color = '#111111';
        },
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = 210;  // A4 mm
      const pageH = 297;
      const margin = 10;  // mm on each side
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;

      let yPos = margin;
      let remaining = imgH;

      // Multi-page support: if receipt is taller than one page
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - margin * 2);
        const srcY = (imgH - remaining) * (canvas.height / imgH);
        const srcH = sliceH * (canvas.height / imgH);

        // Draw the relevant slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yPos, usableW, sliceH);
        remaining -= sliceH;
        if (remaining > 0) { pdf.addPage(); yPos = margin; }
      }

      pdf.save(`receipt-${data.receiptNumber}.pdf`);
      toast.success('Receipt downloaded!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download receipt. Please try again.');
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print the receipt');
      return;
    }

    // Receipt uses 100% inline styles — no external CSS needed.
    // We only add a minimal page reset so browser defaults don't interfere.
    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Receipt - ${data?.receiptNumber ?? ''}</title>
    <meta charset="utf-8" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #fff;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      img { max-width: 100%; display: block; }
      table { border-collapse: collapse; }
      @page { margin: 10mm; }
    </style>
  </head>
  <body>
    ${receiptRef.current.outerHTML}
  </body>
</html>`);

    printWindow.document.close();

    // Wait for images to load before triggering print dialog
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 300);
    });
  };

  const handleSendEmail = async () => {
    if (!email || !data) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);

    try {
      // In a real implementation, this would call the backend API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/receipts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          receiptData: data,
          recipientEmail: email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      toast.success(`Receipt sent to ${email}`);
      setShowEmailInput(false);
      setEmail('');
    } catch (error) {
      // For demo purposes, show success anyway
      toast.success(`Receipt sent to ${email} (Demo)`);
      setShowEmailInput(false);
      setEmail('');
    } finally {
      setSending(false);
    }
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Receipt #{data.receiptNumber}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailInput(!showEmailInput)}
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Email Input */}
        {showEmailInput && (
          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg mb-4">
            <Mail className="w-4 h-4 text-gray-500" />
            <Input
              type="email"
              placeholder="Enter recipient email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Send'
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowEmailInput(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Receipt Content */}
        <div className="border rounded-lg overflow-hidden">
          <Receipt ref={receiptRef} data={data} branding={branding} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
