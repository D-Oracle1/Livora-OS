'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Home, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { NairaSign } from '@/components/icons/naira-sign';

interface SaleApprovalData {
  saleId: string;
  propertyTitle?: string;
  salePrice?: number;
  realtorName?: string;
  clientName?: string;
  paymentPlan?: string;
}

interface SaleApprovalModalProps {
  open: boolean;
  onClose: () => void;
  saleData: SaleApprovalData | null;
}

export function SaleApprovalModal({ open, onClose, saleData }: SaleApprovalModalProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!saleData) return null;

  const handleApprove = async () => {
    setLoading('approve');
    try {
      await api.patch(`/sales/${saleData.saleId}/approve`, {});
      toast.success('Sale approved successfully');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve sale');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }

    setLoading('reject');
    try {
      await api.patch(`/sales/${saleData.saleId}/reject`, { reason: rejectReason || undefined });
      toast.success('Sale rejected');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject sale');
    } finally {
      setLoading(null);
      setShowRejectReason(false);
      setRejectReason('');
    }
  };

  const handleClose = () => {
    setShowRejectReason(false);
    setRejectReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NairaSign className="w-5 h-5 text-[#fca639]" />
            New Sale Report — Approval Required
          </DialogTitle>
          <DialogDescription>
            A realtor has submitted a new sale report. Please review and approve or reject.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Home className="w-3 h-3" /> Property
              </p>
              <p className="font-semibold text-sm">{saleData.propertyTitle || 'Unknown'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <NairaSign className="w-3 h-3" /> Amount
              </p>
              <p className="font-semibold text-sm text-[#2b1464]">
                {saleData.salePrice ? formatCurrency(saleData.salePrice) : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Realtor
              </p>
              <p className="font-semibold text-sm">{saleData.realtorName || 'Unknown'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Client
              </p>
              <p className="font-semibold text-sm">{saleData.clientName || 'Unknown'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Payment Plan:</span>
            <Badge variant={saleData.paymentPlan === 'INSTALLMENT' ? 'outline' : 'default'}>
              {saleData.paymentPlan === 'INSTALLMENT' ? 'Installment' : 'Full Payment'}
            </Badge>
          </div>

          {showRejectReason && (
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Reason for rejection (optional)</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejecting this sale..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {showRejectReason ? (
            <>
              <Button variant="outline" onClick={() => setShowRejectReason(false)} disabled={!!loading}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!!loading}
              >
                {loading === 'reject' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <XCircle className="w-4 h-4 mr-2" />
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!!loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-[#2b1464] hover:bg-[#1e0e47] text-white"
                onClick={handleApprove}
                disabled={!!loading}
              >
                {loading === 'approve' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Sale
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
