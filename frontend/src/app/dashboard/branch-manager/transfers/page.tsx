'use client';

import { useState, useEffect } from 'react';
import { ArrowRightLeft, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { toast } from 'sonner';

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  PENDING:  { label: 'Pending',  icon: Clock,        color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'Approved', icon: CheckCircle,  color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', icon: XCircle,      color: 'bg-red-100 text-red-600' },
};

export default function BranchTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('ALL');

  const user = getUser();

  const load = async () => {
    setLoading(true);
    try {
      const branchId = user?.branchId;
      const res = await api.get(`/branches/transfers/list?branchId=${branchId}`);
      const list = res?.data ?? res ?? [];
      setTransfers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? transfers : transfers.filter(t => t.status === filter);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Property Transfers</h1>
          <Badge variant="secondary">{transfers.length}</Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">No transfers found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const { icon: Icon, color, label } = STATUS_MAP[t.status] ?? STATUS_MAP.PENDING;
            const isMyBranchSender = t.fromBranch?.id === user?.branchId;
            return (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {t.property?.title ?? 'Property'}
                        </span>
                        <Badge className={`text-xs ${color}`}>
                          <Icon className="w-3 h-3 mr-1 inline" />{label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t.property?.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-300">
                          {t.fromBranch?.name} ({t.fromBranch?.code})
                        </span>
                        <ArrowRightLeft className="w-3 h-3 text-primary" />
                        <span className="font-medium text-gray-600 dark:text-gray-300">
                          {t.toBranch?.name} ({t.toBranch?.code})
                        </span>
                      </div>
                      {t.reason && <p className="text-xs text-gray-400 italic">"{t.reason}"</p>}
                      <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
                    </div>
                    {isMyBranchSender && t.status === 'PENDING' && (
                      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                        Awaiting approval
                      </Badge>
                    )}
                    {!isMyBranchSender && t.status === 'PENDING' && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                        Incoming request
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
