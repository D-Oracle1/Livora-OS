'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Search,
  MapPin,
  DollarSign,
  Eye,
  Tag,
  FileText,
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

type PropertyFilter = 'all' | 'owned' | 'listed';

export default function ClientPropertiesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilter>('all');
  const [properties, setProperties] = useState<any[]>([]);

  const fetchProperties = useCallback(async () => {
    try {
      const response: any = await api.get('/properties?limit=100');
      const payload = response.data || response;
      const records = Array.isArray(payload) ? payload : payload?.data || [];
      const mapped = records.map((p: any) => ({
        id: p.id,
        title: p.title || 'Property',
        address: p.address || `${p.city || ''}, ${p.state || ''}`,
        type: p.type || 'Property',
        purchasePrice: Number(p.originalPrice || p.price) || 0,
        purchaseDate: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '',
        currentValue: Number(p.price) || 0,
        isListed: p.isListed || false,
        listingPrice: Number(p.listingPrice) || 0,
        offers: 0,
        image: p.images?.[0] || null,
        seller: '',
        sellerEmail: '',
        sqm: Number(p.area) || 0,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
      }));
      setProperties(mapped);
    } catch {
      // API unavailable, show empty state
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesSearch = property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = propertyFilter === 'all' ||
                           (propertyFilter === 'listed' && property.isListed) ||
                           (propertyFilter === 'owned' && !property.isListed);
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, propertyFilter]);

  const stats = useMemo(() => {
    const totalValue = filteredProperties.reduce((sum, p) => sum + p.currentValue, 0);
    const listedCount = filteredProperties.filter(p => p.isListed).length;

    return [
      { title: 'Total Properties', value: filteredProperties.length.toString(), icon: Home, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Portfolio Value', value: formatCurrency(totalValue), icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Listed for Sale', value: listedCount.toString(), icon: Tag, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    ];
  }, [filteredProperties]);

  const handleViewReceipt = (property: typeof properties[0]) => {
    const receiptData: ReceiptData = {
      receiptNumber: `PUR-${property.id.toString().padStart(6, '0')}`,
      type: 'sale',
      date: property.purchaseDate,
      seller: {
        name: property.seller,
        email: property.sellerEmail,
      },
      buyer: {
        name: 'Client Name', // Would come from auth context
        email: 'client@email.com',
      },
      property: {
        name: property.title,
        type: property.type,
        address: property.address,
      },
      items: [
        { description: `${property.type} Purchase`, amount: property.purchasePrice },
      ],
      subtotal: property.purchasePrice,
      total: property.purchasePrice,
      status: 'paid',
      notes: property.type === 'Land' && property.sqm
        ? `Size: ${property.sqm.toLocaleString()} sqm | Price per plot: ${formatCurrency(property.purchasePrice / property.sqm)}`
        : property.bedrooms
        ? `${property.bedrooms} Bedrooms, ${property.bathrooms} Bathrooms`
        : undefined,
    };
    setSelectedReceipt(receiptData);
    setReceiptModalOpen(true);
  };

  const handleListForSale = (propertyId: number) => {
    toast.success('Property listing dialog would open here.');
  };

  const handleViewOffers = (propertyId: number) => {
    toast.info('Redirecting to offers page...');
  };

  const handleExportCSV = () => {
    const headers = ['Title', 'Type', 'Address', 'Purchase Price', 'Current Value', 'Status', 'Purchase Date'];
    const csvContent = [
      headers.join(','),
      ...filteredProperties.map(p => [
        `"${p.title}"`,
        p.type,
        `"${p.address}"`,
        p.purchasePrice,
        p.currentValue,
        p.isListed ? 'Listed' : 'Owned',
        p.purchaseDate,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-properties-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Properties data exported successfully!');
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

      {/* Properties List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              My Properties
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  className="pl-9 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value as PropertyFilter)}
              >
                <option value="all">All Properties</option>
                <option value="owned">Owned</option>
                <option value="listed">Listed for Sale</option>
              </select>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex flex-col md:flex-row gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="w-full md:w-48 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home className="w-12 h-12 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{property.title}</h3>
                          <Badge variant="outline" className="text-xs">{property.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {property.address}
                        </p>
                      </div>
                      {property.isListed ? (
                        <Badge variant="success">Listed for Sale</Badge>
                      ) : (
                        <Badge variant="secondary">Owned</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Purchase Price</p>
                        <p className="font-semibold">{formatCurrency(property.purchasePrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Value</p>
                        <p className="font-semibold text-primary">{formatCurrency(property.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Purchased</p>
                        <p className="font-semibold">{formatDate(property.purchaseDate)}</p>
                      </div>
                    </div>


                    {property.isListed && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Listing Price</p>
                            <p className="font-semibold text-green-600">{formatCurrency(property.listingPrice!)}</p>
                          </div>
                          <Badge variant="outline">{property.offers} Offers</Badge>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      {!property.isListed ? (
                        <Button variant="outline" size="sm" onClick={() => handleListForSale(property.id)}>
                          <Tag className="w-4 h-4 mr-2" />
                          List for Sale
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleViewOffers(property.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Offers ({property.offers})
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(property)}>
                        <FileText className="w-4 h-4 mr-2" />
                        Purchase Receipt
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProperties.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No properties found for the selected filters.
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
