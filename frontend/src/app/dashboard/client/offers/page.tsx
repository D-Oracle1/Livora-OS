'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  User,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ReceiptModal, ReceiptData } from '@/components/receipt';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';

type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

export default function ClientOffersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [offers, setOffers] = useState<any[]>([]);

  const fetchOffers = useCallback(async () => {
    try {
      const response: any = await api.get('/offers?limit=50');
      const payload = response.data || response;
      const records = Array.isArray(payload) ? payload : payload?.data || [];
      const mapped = records.map((o: any) => ({
        id: o.id,
        property: o.property?.title || 'Property',
        propertyType: o.property?.type || 'Property',
        propertyAddress: o.property?.address || '',
        listingPrice: Number(o.property?.listingPrice || o.property?.price) || 0,
        offerAmount: Number(o.amount) || 0,
        seller: '',
        sellerEmail: '',
        status: o.status || 'PENDING',
        submittedDate: o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
        counterAmount: Number(o.counterAmount) || 0,
      }));
      setOffers(mapped);
    } catch {
      // API unavailable, show empty state
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const filterByTimePeriod = (date: string) => {
    const itemDate = new Date(date);
    const now = new Date();

    switch (timePeriod) {
      case 'month':
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return itemDate >= quarterStart;
      case 'year':
        return itemDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = offer.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           offer.seller.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || offer.status === filterStatus;
      const matchesTime = filterByTimePeriod(offer.submittedDate);
      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [searchTerm, filterStatus, timePeriod]);

  const stats = useMemo(() => {
    const pendingCount = filteredOffers.filter(o => o.status === 'PENDING').length;
    const acceptedCount = filteredOffers.filter(o => o.status === 'ACCEPTED').length;
    const totalValue = filteredOffers.reduce((sum, o) => sum + o.offerAmount, 0);

    return [
      { title: 'Total Offers', value: filteredOffers.length.toString(), icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Pending', value: pendingCount.toString(), icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'Accepted', value: acceptedCount.toString(), icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Total Value', value: formatCurrency(totalValue), icon: NairaSign, color: 'text-primary', bgColor: 'bg-primary/10' },
    ];
  }, [filteredOffers]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending</Badge>;
      case 'ACCEPTED': return <Badge variant="success">Accepted</Badge>;
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
      case 'COUNTERED': return <Badge variant="outline" className="border-blue-500 text-blue-500">Countered</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleViewReceipt = (offer: typeof offers[0]) => {
    const receiptData: ReceiptData = {
      receiptNumber: `OFF-${offer.id.toString().padStart(6, '0')}`,
      type: 'offer',
      date: offer.submittedDate,
      seller: {
        name: offer.seller,
        email: offer.sellerEmail,
      },
      buyer: {
        name: 'Client Name', // Would come from auth context
        email: 'client@email.com',
      },
      property: {
        name: offer.property,
        type: offer.propertyType,
        address: offer.propertyAddress,
      },
      items: [
        { description: 'Property Offer', amount: offer.offerAmount },
      ],
      subtotal: offer.offerAmount,
      total: offer.offerAmount,
      status: offer.status === 'ACCEPTED' ? 'paid' : 'pending',
      notes: `Listing Price: ${formatCurrency(offer.listingPrice)} | Offer: ${((offer.offerAmount / offer.listingPrice) * 100).toFixed(1)}% of asking`,
    };
    setSelectedReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const handleAcceptCounter = (offerId: number) => {
    toast.success('Counter offer accepted! Proceeding to payment.');
  };

  const handleRejectCounter = (offerId: number) => {
    toast.info('Counter offer rejected.');
  };

  const handleWithdrawOffer = (offerId: number) => {
    toast.success('Offer withdrawn successfully.');
  };

  const handleExportCSV = () => {
    const headers = ['Property', 'Seller', 'Listing Price', 'Offer Amount', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...filteredOffers.map(offer => [
        `"${offer.property}"`,
        `"${offer.seller}"`,
        offer.listingPrice,
        offer.offerAmount,
        offer.status,
        offer.submittedDate,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-offers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Offers data exported successfully!');
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${stat.bgColor} mb-4`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Offers List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              My Offers
              <Badge variant="outline" className="ml-2">{getTimePeriodLabel()}</Badge>
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search offers..."
                  className="pl-9 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="COUNTERED">Countered</option>
              </select>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              >
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOffers.map((offer) => (
                <div
                  key={offer.id}
                  className={`p-4 rounded-lg border ${
                    offer.status === 'PENDING'
                      ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10'
                      : offer.status === 'COUNTERED'
                      ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/10'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{offer.property}</h3>
                        <p className="text-sm text-muted-foreground">{offer.propertyAddress}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Seller: {offer.seller}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Listing Price</p>
                        <p className="font-medium">{formatCurrency(offer.listingPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">My Offer</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(offer.offerAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {((offer.offerAmount / offer.listingPrice) * 100).toFixed(1)}% of asking
                        </p>
                      </div>
                      {getStatusBadge(offer.status)}
                    </div>
                  </div>

                  {/* Counter offer display */}
                  {offer.status === 'COUNTERED' && offer.counterAmount && (
                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Counter Offer Received</p>
                          <p className="text-xs text-muted-foreground">The seller has made a counter offer</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">{formatCurrency(offer.counterAmount)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Submitted: {formatDate(offer.submittedDate)}
                      {offer.status === 'PENDING' && offer.expiresDate && (
                        <span className="ml-4 text-orange-600">Expires: {formatDate(offer.expiresDate)}</span>
                      )}
                      {offer.status === 'ACCEPTED' && offer.acceptedDate && (
                        <span className="ml-4 text-green-600">Accepted: {formatDate(offer.acceptedDate)}</span>
                      )}
                      {offer.status === 'REJECTED' && offer.rejectedDate && (
                        <span className="ml-4 text-red-600">Rejected: {formatDate(offer.rejectedDate)}</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4 md:mt-0">
                      {offer.status === 'ACCEPTED' && (
                        <>
                          <Button size="sm" variant="success">Proceed to Payment</Button>
                          <Button size="sm" variant="outline" onClick={() => handleViewReceipt(offer)}>
                            <FileText className="w-4 h-4 mr-1" />
                            Receipt
                          </Button>
                        </>
                      )}
                      {offer.status === 'COUNTERED' && (
                        <>
                          <Button size="sm" variant="success" onClick={() => handleAcceptCounter(offer.id)}>
                            Accept Counter
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleRejectCounter(offer.id)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {offer.status === 'PENDING' && (
                        <Button size="sm" variant="outline" onClick={() => handleWithdrawOffer(offer.id)}>
                          Withdraw Offer
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleViewReceipt(offer)}>
                        <FileText className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredOffers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No offers found for the selected filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        data={selectedReceipt}
      />
    </div>
  );
}
