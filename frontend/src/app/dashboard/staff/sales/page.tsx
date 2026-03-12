'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Search,
  MapPin,
  LandPlot,
  Building2,
  Loader2,
  CheckCircle,
  User,
  Mail,
  Phone,
  FileText,
  ShoppingCart,
  DollarSign,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatArea, type AreaUnit, AREA_UNITS, toSqm, fromSqm } from '@/lib/utils';
import { api, getImageUrl } from '@/lib/api';
import { AreaUnitSelect } from '@/components/area-unit-select';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth-storage';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
    case 'LISTED':
      return <Badge variant="success">Available</Badge>;
    case 'PENDING':
    case 'UNDER_CONTRACT':
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending</Badge>;
    case 'SOLD':
      return <Badge variant="secondary">Sold Out</Badge>;
    case 'OFF_MARKET':
      return <Badge variant="outline">Off Market</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const getPropertyIcon = (type: string) => {
  switch (type) {
    case 'LAND': return <LandPlot className="w-12 h-12 text-gray-400" />;
    case 'COMMERCIAL': return <Building2 className="w-12 h-12 text-gray-400" />;
    default: return <Home className="w-12 h-12 text-gray-400" />;
  }
};

interface SaleReportForm {
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string;
  plotsSold: string;
  sqmSold: string;
  pricePerSqm: string;
  totalAmount: string;
  paymentMethod: string;
  notes: string;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  numberOfInstallments: string;
  firstPaymentAmount: string;
  saleDate: string;
}

interface Realtor {
  id: string;
  user: { firstName: string; lastName: string };
}

export default function StaffSalesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isReportSaleOpen, setIsReportSaleOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportedSales, setReportedSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [saleAreaUnit, setSaleAreaUnit] = useState<AreaUnit>('plot');
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [selectedRealtorId, setSelectedRealtorId] = useState('');
  const [saleAttribution, setSaleAttribution] = useState<'REALTOR' | 'COMPANY'>('REALTOR');

  const [saleForm, setSaleForm] = useState<SaleReportForm>({
    buyerFirstName: '',
    buyerLastName: '',
    buyerEmail: '',
    buyerPhone: '',
    plotsSold: '1',
    sqmSold: '',
    pricePerSqm: '',
    totalAmount: '',
    paymentMethod: 'BANK_TRANSFER',
    notes: '',
    paymentPlan: 'FULL',
    numberOfInstallments: '1',
    firstPaymentAmount: '',
    saleDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchProperties();
    fetchSales();
    fetchRealtors();
  }, []);

  const fetchProperties = async () => {
    if (!getToken()) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const response: any = await api.get('/properties?limit=100');
      const wrapped = response?.data || response;
      setProperties(Array.isArray(wrapped) ? wrapped : (wrapped?.data || []));
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSales = async () => {
    if (!getToken()) { setSalesLoading(false); return; }
    try {
      setSalesLoading(true);
      const response: any = await api.get('/sales?limit=20');
      const wrapped = response?.data || response;
      setReportedSales(Array.isArray(wrapped) ? wrapped : (wrapped?.data || []));
    } catch {
      // Ignore — sales will show empty
    } finally {
      setSalesLoading(false);
    }
  };

  const fetchRealtors = async () => {
    try {
      const res: any = await api.get('/realtors/directory');
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setRealtors(list);
    } catch {
      setRealtors([]);
    }
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = (property.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (property.address || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' ||
      (filterStatus === 'FOR_SALE' && (property.isListed || property.status === 'AVAILABLE' || property.status === 'LISTED')) ||
      (filterStatus === 'SOLD' && property.status === 'SOLD');
    const matchesType = filterType === 'ALL' || property.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const openReportSale = (property: any) => {
    setSelectedProperty(property);
    setSaleAreaUnit('plot');
    setSelectedRealtorId('');
    setSaleAttribution('REALTOR');
    const isLand = property.type === 'LAND';
    const storedPricePerSqm = Number(property.pricePerSqm) || 0;
    setSaleForm({
      buyerFirstName: '',
      buyerLastName: '',
      buyerEmail: '',
      buyerPhone: '',
      plotsSold: '1',
      sqmSold: String(property.area || 0),
      pricePerSqm: String(storedPricePerSqm),
      totalAmount: isLand && storedPricePerSqm > 0
        ? String(storedPricePerSqm * (property.area || 0))
        : String(Number(property.price) || 0),
      paymentMethod: 'BANK_TRANSFER',
      notes: '',
      paymentPlan: 'FULL',
      numberOfInstallments: '1',
      firstPaymentAmount: '',
      saleDate: new Date().toISOString().split('T')[0],
    });
    setIsReportSaleOpen(true);
  };

  const handleSaleAreaUnitChange = (newUnit: AreaUnit) => {
    const currentValue = parseFloat(saleForm.sqmSold) || 0;
    if (currentValue > 0) {
      const sqmValue = toSqm(currentValue, saleAreaUnit);
      const converted = fromSqm(sqmValue, newUnit);
      setSaleForm(prev => ({
        ...prev,
        sqmSold: converted % 1 === 0 ? String(converted) : converted.toFixed(2),
      }));
    }
    setSaleAreaUnit(newUnit);
  };

  const updateSaleForm = (field: keyof SaleReportForm, value: string) => {
    setSaleForm(prev => {
      const updated = { ...prev, [field]: value };
      if (selectedProperty?.type === 'LAND' && (field === 'sqmSold' || field === 'pricePerSqm')) {
        const sqm = parseFloat(field === 'sqmSold' ? value : updated.sqmSold) || 0;
        const price = parseFloat(field === 'pricePerSqm' ? value : updated.pricePerSqm) || 0;
        updated.totalAmount = (sqm * price).toString();
      }
      return updated;
    });
  };

  const handleSubmitSale = async () => {
    if (saleAttribution === 'REALTOR' && !selectedRealtorId) {
      toast.error('Please select a realtor to attribute this sale to');
      return;
    }
    if (!saleForm.buyerFirstName || !saleForm.buyerLastName || !saleForm.buyerEmail) {
      toast.error('Please fill in buyer name and email');
      return;
    }
    if (!saleForm.totalAmount || parseFloat(saleForm.totalAmount) <= 0) {
      toast.error('Please fill in sale amount');
      return;
    }
    if (saleForm.paymentPlan === 'INSTALLMENT') {
      const firstPayment = parseFloat(saleForm.firstPaymentAmount) || 0;
      if (firstPayment <= 0) {
        toast.error('Please enter a first payment amount for installment plan');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const saleData: any = {
        clientName: `${saleForm.buyerFirstName} ${saleForm.buyerLastName}`,
        clientEmail: saleForm.buyerEmail,
        clientContact: saleForm.buyerPhone || undefined,
        propertyId: selectedProperty.id,
        saleValue: parseFloat(saleForm.totalAmount),
        saleDate: saleForm.saleDate,
        notes: saleForm.notes || undefined,
        paymentPlan: saleForm.paymentPlan,
        paymentMethod: saleForm.paymentMethod || undefined,
        areaSold: toSqm(parseFloat(saleForm.sqmSold) || 0, saleAreaUnit) || undefined,
        ...(saleAttribution === 'REALTOR' && selectedRealtorId ? { realtorId: selectedRealtorId } : {}),
      };

      if (saleForm.paymentPlan === 'INSTALLMENT') {
        saleData.numberOfInstallments = parseInt(saleForm.numberOfInstallments) || 2;
        saleData.firstPaymentAmount = parseFloat(saleForm.firstPaymentAmount) || 0;
      }

      await api.post('/sales', saleData);
      toast.success('Sale reported successfully!');
      setIsReportSaleOpen(false);
      setSelectedProperty(null);
      fetchProperties();
      fetchSales();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to report sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLandProperty = selectedProperty?.type === 'LAND';
  const availableCount = properties.filter(p => p.status === 'AVAILABLE' || p.status === 'LISTED' || p.isListed).length;

  const statsData = [
    { title: 'Available Properties', value: availableCount.toString(), icon: Home, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Sales Reported', value: reportedSales.length.toString(), icon: ShoppingCart, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Pending Approval', value: reportedSales.filter((s: any) => s.status === 'PENDING').length.toString(), icon: DollarSign, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { title: 'Completed', value: reportedSales.filter((s: any) => s.status === 'COMPLETED').length.toString(), icon: CheckCircle, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat, index) => (
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

      {/* Recent Reported Sales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Sales Reported
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : reportedSales.length > 0 ? (
              <div className="space-y-3">
                {reportedSales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{sale.property?.title || 'Unknown Property'}</h4>
                      <p className="text-sm text-muted-foreground">
                        Buyer: {sale.client?.user ? `${sale.client.user.firstName} ${sale.client.user.lastName}` : 'Unknown'}
                        {' \u2022 '}
                        Realtor: {sale.realtor?.user ? `${sale.realtor.user.firstName} ${sale.realtor.user.lastName}` : 'Unknown'}
                        {sale.areaSold ? ` \u2022 ${formatArea(sale.areaSold)}` : ''}
                        {' \u2022 '}{new Date(sale.saleDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold text-[#0b5c46]">{formatCurrency(Number(sale.salePrice))}</p>
                      <Badge className={
                        sale.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        sale.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        sale.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }>
                        {sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sales reported yet.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Properties */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                Properties
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Select a property to report a sale</p>
            </div>
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
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="LAND">Land</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="APARTMENT">Apartment</option>
              </select>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="FOR_SALE">Available</option>
                <option value="SOLD">Sold Out</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProperties.map((property) => {
                  const isAvailable = property.status === 'AVAILABLE' || property.status === 'LISTED' || property.isListed;
                  return (
                    <div
                      key={property.id}
                      className="flex flex-col md:flex-row gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="w-full md:w-48 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                        {property.images && property.images.length > 0 ? (
                          <img
                            src={getImageUrl(property.images[0])}
                            alt={property.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getPropertyIcon(property.type)
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{property.title}</h3>
                              <Badge variant="outline" className="text-xs">{property.type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {property.address}{property.city ? `, ${property.city}` : ''}
                            </p>
                          </div>
                          {getStatusBadge(property.status)}
                        </div>
                        <p className="text-2xl font-bold text-primary mb-1">{formatCurrency(Number(property.price))}</p>
                        {property.type === 'LAND' && Number(property.pricePerSqm) > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge className="bg-green-100 text-green-700">
                              {formatCurrency(Number(property.pricePerSqm))}/plot
                            </Badge>
                          </div>
                        )}
                        <div className="flex gap-2">
                          {isAvailable && (
                            <Button
                              className="bg-[#0b5c46] hover:bg-[#094a38]"
                              onClick={() => openReportSale(property)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Report Sale
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredProperties.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No properties found matching your filters.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Report Sale Dialog */}
      <Dialog open={isReportSaleOpen} onOpenChange={setIsReportSaleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#0b5c46]" />
              Report Sale
            </DialogTitle>
            <DialogDescription>
              Report a sale for: <strong>{selectedProperty?.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Property Summary */}
            <div className="p-4 bg-[#0b5c46]/5 border border-[#0b5c46]/20 rounded-lg">
              <h4 className="font-semibold text-[#0b5c46] mb-2">Property Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedProperty?.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-medium">{formatCurrency(Number(selectedProperty?.price) || 0)}</p>
                </div>
              </div>
            </div>

            {/* Sale Attribution */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Sale Attribution *
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaleAttribution('REALTOR')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    saleAttribution === 'REALTOR'
                      ? 'border-[#0b5c46] bg-[#0b5c46]/10 text-[#0b5c46]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Assign to Realtor
                </button>
                <button
                  type="button"
                  onClick={() => setSaleAttribution('COMPANY')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    saleAttribution === 'COMPANY'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Company Sale
                </button>
              </div>

              {saleAttribution === 'REALTOR' ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">The selected realtor will be credited and earn commission.</p>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={selectedRealtorId}
                    onChange={(e) => setSelectedRealtorId(e.target.value)}
                  >
                    <option value="">— Select a realtor —</option>
                    {realtors.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.user.firstName} {r.user.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">Company Sale</p>
                  <p className="text-xs text-blue-600 mt-1">This sale will be credited to the company. No commission or loyalty points will be awarded.</p>
                </div>
              )}
            </div>

            {/* Buyer Information */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Buyer Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="Enter first name"
                    value={saleForm.buyerFirstName}
                    onChange={(e) => updateSaleForm('buyerFirstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="Enter last name"
                    value={saleForm.buyerLastName}
                    onChange={(e) => updateSaleForm('buyerLastName', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="buyer@email.com"
                      className="pl-9"
                      value={saleForm.buyerEmail}
                      onChange={(e) => updateSaleForm('buyerEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="+234 xxx xxx xxxx"
                      className="pl-9"
                      value={saleForm.buyerPhone}
                      onChange={(e) => updateSaleForm('buyerPhone', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sale Details */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Sale Details
              </h4>

              {/* Date of Sale */}
              <div className="space-y-2">
                <Label htmlFor="saleDate">Date of Sale *</Label>
                <Input
                  id="saleDate"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={saleForm.saleDate}
                  onChange={e => updateSaleForm('saleDate', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">You can backdate to when the sale actually occurred</p>
              </div>

              {/* Payment Plan Toggle */}
              <div className="space-y-2">
                <Label>Payment Plan</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateSaleForm('paymentPlan', 'FULL')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      saleForm.paymentPlan === 'FULL'
                        ? 'border-[#0b5c46] bg-[#0b5c46]/10 text-[#0b5c46]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSaleForm('paymentPlan', 'INSTALLMENT')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      saleForm.paymentPlan === 'INSTALLMENT'
                        ? 'border-[#fca639] bg-[#fca639]/10 text-[#fca639]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Installment
                  </button>
                </div>
              </div>

              {saleForm.paymentPlan === 'INSTALLMENT' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#fca639]/5 border border-[#fca639]/20 rounded-lg">
                  <div className="space-y-2">
                    <Label>Number of Installments</Label>
                    <Input
                      type="number"
                      min="2"
                      max="24"
                      value={saleForm.numberOfInstallments}
                      onChange={(e) => updateSaleForm('numberOfInstallments', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>First Payment Amount (₦)</Label>
                    <Input
                      type="number"
                      placeholder="Amount for first installment"
                      value={saleForm.firstPaymentAmount}
                      onChange={(e) => updateSaleForm('firstPaymentAmount', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Area and pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Size Sold ({AREA_UNITS[saleAreaUnit].shortLabel})</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={saleForm.sqmSold}
                      onChange={(e) => updateSaleForm('sqmSold', e.target.value)}
                      className="flex-1"
                    />
                    <AreaUnitSelect
                      value={saleAreaUnit}
                      onChange={handleSaleAreaUnitChange}
                    />
                  </div>
                  {saleAreaUnit !== 'sqm' && parseFloat(saleForm.sqmSold) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      = {toSqm(parseFloat(saleForm.sqmSold), saleAreaUnit).toLocaleString()} sqm
                    </p>
                  )}
                </div>
                {isLandProperty ? (
                  <div className="space-y-2">
                    <Label>Price per Plot (₦)</Label>
                    <Input
                      type="number"
                      value={saleForm.pricePerSqm}
                      onChange={(e) => updateSaleForm('pricePerSqm', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={saleForm.paymentMethod}
                      onChange={(e) => updateSaleForm('paymentMethod', e.target.value)}
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="MORTGAGE">Mortgage</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Sale Amount (₦) *</Label>
                  {isLandProperty ? (
                    <div className="px-3 py-2 bg-[#0b5c46]/10 border border-[#0b5c46]/20 rounded-md text-lg font-bold text-[#0b5c46]">
                      {formatCurrency(parseFloat(saleForm.totalAmount) || 0)}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={saleForm.totalAmount}
                      onChange={(e) => updateSaleForm('totalAmount', e.target.value)}
                    />
                  )}
                </div>
                {isLandProperty && (
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      value={saleForm.paymentMethod}
                      onChange={(e) => updateSaleForm('paymentMethod', e.target.value)}
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="MORTGAGE">Mortgage</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md min-h-20 resize-none text-sm"
                  placeholder="Any additional notes about the sale..."
                  value={saleForm.notes}
                  onChange={(e) => updateSaleForm('notes', e.target.value)}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-[#fca639]/10 border border-[#fca639]/20 rounded-lg">
              <h4 className="font-semibold text-[#fca639] mb-2">Sale Summary</h4>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedProperty?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Buyer: {saleForm.buyerFirstName} {saleForm.buyerLastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Credited to:{' '}
                    {saleAttribution === 'COMPANY'
                      ? 'Company'
                      : selectedRealtorId
                        ? `${realtors.find(r => r.id === selectedRealtorId)?.user.firstName} ${realtors.find(r => r.id === selectedRealtorId)?.user.lastName}`
                        : '—'}
                  </p>
                </div>
                <p className="text-2xl font-bold text-[#0b5c46]">
                  {formatCurrency(parseFloat(saleForm.totalAmount) || 0)}
                </p>
              </div>
              {saleForm.paymentPlan === 'INSTALLMENT' && (
                <div className="mt-3 pt-3 border-t border-[#fca639]/20">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Payment Plan</p>
                      <p className="font-medium text-[#fca639]">Installment ({saleForm.numberOfInstallments} payments)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">First Payment</p>
                      <p className="font-medium">{formatCurrency(parseFloat(saleForm.firstPaymentAmount) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-medium">{formatCurrency((parseFloat(saleForm.totalAmount) || 0) - (parseFloat(saleForm.firstPaymentAmount) || 0))}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportSaleOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0b5c46] hover:bg-[#094a38]"
              onClick={handleSubmitSale}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Sale Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
