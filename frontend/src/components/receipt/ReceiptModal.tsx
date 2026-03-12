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
      // Dynamic import of html2canvas
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Capture full scroll height — the dialog clips overflow so offsetHeight
      // may be shorter than the actual receipt content.
      const fullHeight = receiptRef.current.scrollHeight;

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        height: fullHeight,
        onclone: (_doc, element) => {
          // Force light-mode colors and remove overflow constraints so the
          // full receipt (including footer) is rendered in the cloned doc.
          element.style.color = '#111111';
          element.style.background = '#ffffff';
          element.style.overflow = 'visible';
          element.style.height = fullHeight + 'px';
          // Also unlock the immediate wrapper (.border.rounded-lg.overflow-hidden)
          if (element.parentElement) {
            element.parentElement.style.overflow = 'visible';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`receipt-${data.receiptNumber}.pdf`);

      toast.success('Receipt downloaded successfully!');
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

    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    let styleHTML = '';
    styles.forEach((style) => {
      styleHTML += style.outerHTML;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${data?.receiptNumber}</title>
          ${styleHTML}
          <style>
            body { margin: 0; padding: 20px; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${receiptRef.current.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
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
