'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Search,
  Plus,
  MapPin,
  Bed,
  Bath,
  Square,
  TrendingUp,
  Eye,
  Upload,
  X,
  LandPlot,
  Building2,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { getToken } from '@/lib/auth-storage';
import { AreaUnitSelect } from '@/components/area-unit-select';
import { toast } from 'sonner';

const propertyTypes = [
  { value: 'LAND', label: 'Land', icon: LandPlot },
  { value: 'RESIDENTIAL', label: 'Residential', icon: Home },
  { value: 'COMMERCIAL', label: 'Commercial', icon: Building2 },
  { value: 'APARTMENT', label: 'Apartment', icon: Building2 },
  { value: 'VILLA', label: 'Villa', icon: Home },
  { value: 'CONDO', label: 'Condo', icon: Building2 },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'FOR_SALE':
    case 'LISTED':
    case 'AVAILABLE':
      return <Badge variant="success">For Sale</Badge>;
    case 'PENDING':
    case 'UNDER_CONTRACT':
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending</Badge>;
    case 'SOLD':
      return <Badge variant="secondary">Sold</Badge>;
    case 'OFF_MARKET':
      return <Badge variant="outline">Off Market</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const getPropertyIcon = (type: string) => {
  switch (type) {
    case 'LAND': return <LandPlot className="w-16 h-16 text-gray-400" />;
    case 'COMMERCIAL': return <Building2 className="w-16 h-16 text-gray-400" />;
    default: return <Home className="w-16 h-16 text-gray-400" />;
  }
};

interface PropertyForm {
  title: string;
  address: string;
  city: string;
  state: string;
  price: string;
  pricePerSqm: string;
  numberOfPlots: string;
  type: string;
  beds: string;
  baths: string;
  sqft: string;
  description: string;
}

const emptyForm: PropertyForm = {
  title: '',
  address: '',
  city: '',
  state: 'Lagos',
  price: '',
  pricePerSqm: '',
  numberOfPlots: '',
  type: 'LAND',
  beds: '',
  baths: '',
  sqft: '',
  description: '',
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, listed: 0, pending: 0, totalValue: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<PropertyForm>({ ...emptyForm });
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('plot');

  // Edit form state
  const [editFormData, setEditFormData] = useState<PropertyForm>({ ...emptyForm });
  const [editAreaUnit, setEditAreaUnit] = useState<AreaUnit>('plot');
  const [editStatus, setEditStatus] = useState<string>('AVAILABLE');
  const [editUploadedImages, setEditUploadedImages] = useState<string[]>([]);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response: any = await api.get('/properties?limit=100');
      // Unwrap TransformInterceptor { success, data, timestamp } then paginated { data, meta }
      const wrapped = response?.data || response;
      const items = Array.isArray(wrapped) ? wrapped : (wrapped?.data || []);
      if (Array.isArray(items)) {
        setProperties(items);
        const listed = items.filter((p: any) => p.isListed).length;
        const pending = items.filter((p: any) => p.status === 'PENDING' || p.status === 'UNDER_CONTRACT').length;
        const totalValue = items.reduce((sum: number, p: any) => sum + Number(p.price || 0), 0);
        setStats({ total: items.length, listed, pending, totalValue });
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = (property.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (property.address || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' ||
      (filterStatus === 'FOR_SALE' && (property.isListed || property.status === 'LISTED' || property.status === 'AVAILABLE')) ||
      (filterStatus === 'PENDING' && (property.status === 'PENDING' || property.status === 'UNDER_CONTRACT')) ||
      (filterStatus === 'SOLD' && property.status === 'SOLD');
    const matchesType = filterType === 'ALL' || property.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
        setError('Please select valid image files (JPEG, PNG, GIF, or WebP)');
        return;
      }

      if (isEdit) {
        setEditImageFiles(prev => [...prev, file]);
      } else {
        setImageFiles(prev => [...prev, file]);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditUploadedImages(prev => [...prev, reader.result as string]);
        } else {
          setUploadedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number, isEdit = false) => {
    if (isEdit) {
      setEditUploadedImages(prev => prev.filter((_, i) => i !== index));
      setEditImageFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
      setImageFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const isLandType = formData.type === 'LAND';
    const hasPricing = isLandType ? !!formData.pricePerSqm : !!formData.price;
    if (!formData.title || !formData.address || !hasPricing) {
      setError(isLandType
        ? 'Please fill in required fields (Title, Address, Price per Plot)'
        : 'Please fill in required fields (Title, Address, Price)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        try {
          const uploadResult = await api.uploadFiles('/upload/property-images', imageFiles, 'images');
          imageUrls = Array.isArray(uploadResult) ? uploadResult : (uploadResult as any)?.data || [];
        } catch {
          // Continue without images
        }
      }

      const areaInUserUnit = parseFloat(formData.sqft) || 0;
      const areaInSqm = toSqm(areaInUserUnit, areaUnit);
      const pricePerPlot = parseFloat(formData.pricePerSqm) || 0;
      let totalPrice = parseFloat(formData.price) || 0;

      const numberOfPlots = areaUnit === 'plot'
        ? Math.round(areaInUserUnit)
        : (parseInt(formData.numberOfPlots) || 1);

      if (formData.type === 'LAND' && pricePerPlot > 0 && numberOfPlots > 0) {
        totalPrice = pricePerPlot * numberOfPlots;
      }

      const propertyData = {
        title: formData.title,
        address: formData.address,
        city: formData.city || 'Lagos',
        state: formData.state,
        country: 'Nigeria',
        price: totalPrice,
        pricePerSqm: formData.type === 'LAND' ? pricePerPlot : undefined,
        numberOfPlots: formData.type === 'LAND' ? numberOfPlots : undefined,
        type: formData.type,
        status: 'AVAILABLE',
        bedrooms: formData.type === 'LAND' ? 0 : parseInt(formData.beds) || 0,
        bathrooms: formData.type === 'LAND' ? 0 : parseInt(formData.baths) || 0,
        area: areaInSqm,
        description: formData.description || '',
        images: imageUrls,
        isListed: true,
      };

      await api.post('/properties', propertyData);
      toast.success('Property created successfully');
      setIsAddDialogOpen(false);
      setFormData({ ...emptyForm });
      setAreaUnit('plot');
      setUploadedImages([]);
      setImageFiles([]);
      fetchProperties();
    } catch (err: any) {
      setError(err.message || 'Failed to create property.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (property: any) => {
    setEditingProperty(property);
    // For LAND with plots, show numberOfPlots in the area field (unit = plot).
    // For everything else, show the stored sqm value (unit = sqm).
    // This prevents the edit form from treating sqm area as a plot count,
    // which would produce totalPrice = pricePerPlot × (area_in_sqm) → overflow.
    const isLandWithPlots = property.type === 'LAND' && property.numberOfPlots > 0;
    setEditFormData({
      title: property.title || '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || 'Lagos',
      price: String(Number(property.price) || ''),
      pricePerSqm: String(Number(property.pricePerSqm) || ''),
      numberOfPlots: String(property.numberOfPlots || ''),
      type: property.type || 'LAND',
      beds: String(property.bedrooms || ''),
      baths: String(property.bathrooms || ''),
      sqft: isLandWithPlots ? String(property.numberOfPlots) : String(property.area || ''),
      description: property.description || '',
    });
    setExistingImages(property.images || []);
    setEditAreaUnit(isLandWithPlots ? 'plot' : 'sqm');
    setEditStatus(property.status || 'AVAILABLE');
    setEditUploadedImages([]);
    setEditImageFiles([]);
    setError(null);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingProperty) return;
    if (!editFormData.title || !editFormData.address) {
      setError('Please fill in required fields (Title, Address)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let newImageUrls: string[] = [];
      if (editImageFiles.length > 0) {
        try {
          const uploadResult = await api.uploadFiles('/upload/property-images', editImageFiles, 'images');
          newImageUrls = Array.isArray(uploadResult) ? uploadResult : (uploadResult as any)?.data || [];
        } catch {
          // Continue without new images
        }
      }

      const allImages = [...existingImages, ...newImageUrls];
      const isLand = editFormData.type === 'LAND';

      const areaInUserUnit = parseFloat(editFormData.sqft) || 0;
      const areaInSqm = toSqm(areaInUserUnit, editAreaUnit);
      const pricePerPlot = parseFloat(editFormData.pricePerSqm) || 0;
      let totalPrice = parseFloat(editFormData.price) || 0;

      const numberOfPlots = editAreaUnit === 'plot'
        ? Math.round(areaInUserUnit)
        : (parseInt(editFormData.numberOfPlots) || 1);

      if (isLand && pricePerPlot > 0 && numberOfPlots > 0) {
        totalPrice = pricePerPlot * numberOfPlots;
      }

      const updateData: any = {
        title: editFormData.title,
        address: editFormData.address,
        city: editFormData.city || undefined,
        state: editFormData.state || undefined,
        price: totalPrice,
        type: editFormData.type,
        bedrooms: isLand ? 0 : parseInt(editFormData.beds) || 0,
        bathrooms: isLand ? 0 : parseFloat(editFormData.baths) || 0,
        area: areaInSqm,
        description: editFormData.description || undefined,
        images: allImages,
        status: editStatus,
        isListed: editStatus === 'AVAILABLE' || editStatus === 'LISTED',
      };

      if (isLand) {
        updateData.pricePerSqm = pricePerPlot;
        updateData.numberOfPlots = numberOfPlots;
      }

      await api.put(`/properties/${editingProperty.id}`, updateData);
      toast.success('Property updated successfully');
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      fetchProperties();
    } catch (err: any) {
      setError(err.message || 'Failed to update property.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = async (property: any) => {
    if (!confirm(`Delete "${property.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/properties/${property.id}`);
      toast.success('Property deleted');
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete property');
    }
  };

  const isLandType = (type: string) => type === 'LAND';

  const statCards = [
    { title: 'Total Properties', value: stats.total.toLocaleString(), icon: Home, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'For Sale', value: stats.listed.toLocaleString(), icon: LandPlot, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Pending', value: stats.pending.toLocaleString(), icon: TrendingUp, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { title: 'Total Value', value: formatCurrency(stats.totalValue), icon: Building2, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  const handleAreaUnitChange = (
    newUnit: AreaUnit,
    currentUnit: AreaUnit,
    data: PropertyForm,
    setData: React.Dispatch<React.SetStateAction<PropertyForm>>,
    setUnit: React.Dispatch<React.SetStateAction<AreaUnit>>,
  ) => {
    const currentValue = parseFloat(data.sqft) || 0;
    if (currentValue > 0) {
      const sqmValue = toSqm(currentValue, currentUnit);
      const converted = fromSqm(sqmValue, newUnit);
      setData(prev => ({
        ...prev,
        sqft: converted % 1 === 0 ? String(converted) : converted.toFixed(2),
      }));
    }
    setUnit(newUnit);
  };

  const renderPropertyForm = (
    data: PropertyForm,
    setData: React.Dispatch<React.SetStateAction<PropertyForm>>,
    images: string[],
    onRemoveImage: (i: number) => void,
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
    currentAreaUnit: AreaUnit,
    setCurrentAreaUnit: React.Dispatch<React.SetStateAction<AreaUnit>>,
    existingImgs?: string[],
    onRemoveExisting?: (i: number) => void,
  ) => {
    const isLand = isLandType(data.type);
    const unitLabel = AREA_UNITS[currentAreaUnit].shortLabel;

    return (
      <div className="grid gap-4 py-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Property Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Property Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {propertyTypes.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => setData(prev => ({ ...prev, type: type.value }))}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  data.type === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <type.icon className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Property Title *</label>
          <Input
            placeholder="e.g., Prime Land in Lekki Phase 1"
            value={data.title}
            onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Address *</label>
            <Input
              placeholder="Street address"
              value={data.address}
              onChange={(e) => setData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Input
              placeholder="e.g., Lekki"
              value={data.city}
              onChange={(e) => setData(prev => ({ ...prev, city: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={data.state}
              onChange={(e) => setData(prev => ({ ...prev, state: e.target.value }))}
            >
              <option value="Lagos">Lagos</option>
              <option value="Abuja">Abuja</option>
              <option value="Rivers">Rivers</option>
              <option value="Oyo">Oyo</option>
              <option value="Kano">Kano</option>
              <option value="Ogun">Ogun</option>
              <option value="Enugu">Enugu</option>
              <option value="Delta">Delta</option>
              <option value="Anambra">Anambra</option>
              <option value="Kaduna">Kaduna</option>
            </select>
          </div>
          {!isLand ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Price (₦) *</label>
              <Input
                type="number"
                placeholder="e.g., 50000000"
                value={data.price}
                onChange={(e) => setData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Plots</label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={data.numberOfPlots}
                onChange={(e) => setData(prev => ({ ...prev, numberOfPlots: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* Land-specific pricing */}
        {isLand && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="space-y-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-400">Price per Plot (₦) *</label>
              <Input
                type="number"
                placeholder="e.g., 5000000"
                value={data.pricePerSqm}
                onChange={(e) => setData(prev => ({ ...prev, pricePerSqm: e.target.value }))}
                className="border-green-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-green-700 dark:text-green-400">Total Value (₦)</label>
              <div className="px-3 py-2 bg-white dark:bg-gray-800 border rounded-md text-lg font-bold text-green-600">
                {formatCurrency(
                  (parseFloat(data.pricePerSqm) || 0) * (currentAreaUnit === 'plot' ? (parseFloat(data.sqft) || 0) : ((parseFloat(data.sqft) || 0) / 465))
                )}
              </div>
              <p className="text-xs text-muted-foreground">Auto-calculated from price/plot × number of plots</p>
            </div>
          </div>
        )}

        {/* Property Details */}
        <div className="grid grid-cols-3 gap-4">
          {!isLand && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bedrooms</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={data.beds}
                  onChange={(e) => setData(prev => ({ ...prev, beds: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bathrooms</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={data.baths}
                  onChange={(e) => setData(prev => ({ ...prev, baths: e.target.value }))}
                />
              </div>
            </>
          )}
          <div className={`space-y-2 ${isLand ? 'col-span-3' : ''}`}>
            <label className="text-sm font-medium">Size ({unitLabel})</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="e.g., 500"
                value={data.sqft}
                onChange={(e) => setData(prev => ({ ...prev, sqft: e.target.value }))}
                className="flex-1"
              />
              <AreaUnitSelect
                value={currentAreaUnit}
                onChange={(newUnit) => handleAreaUnitChange(newUnit, currentAreaUnit, data, setData, setCurrentAreaUnit)}
              />
            </div>
            {currentAreaUnit !== 'sqm' && parseFloat(data.sqft) > 0 && (
              <p className="text-xs text-muted-foreground">
                = {toSqm(parseFloat(data.sqft), currentAreaUnit).toLocaleString()} sqm
              </p>
            )}
          </div>
        </div>

        {/* Status (edit mode only) */}
        {existingImgs !== undefined && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="AVAILABLE">For Sale (Available)</option>
              <option value="LISTED">Listed</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_CONTRACT">Under Contract</option>
              <option value="SOLD">Sold</option>
              <option value="OFF_MARKET">Off Market</option>
            </select>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="w-full px-3 py-2 border rounded-md min-h-20 resize-none text-sm"
            placeholder="Describe the property..."
            value={data.description}
            onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Property Images</label>

          {/* Existing images (edit mode) */}
          {existingImgs && existingImgs.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {existingImgs.map((image, index) => (
                <div key={`existing-${index}`} className="relative group">
                  <img
                    src={getImageUrl(image)}
                    alt={`Existing ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border-2 border-primary/30"
                  />
                  <button
                    onClick={() => onRemoveExisting?.(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              type="file"
              ref={inputRef as React.RefObject<HTMLInputElement>}
              onChange={(e) => onImageUpload(e)}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload images</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, GIF up to 5MB each</p>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => onRemoveImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
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
              All Properties
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
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="LAND">Land</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="APARTMENT">Apartment</option>
                <option value="VILLA">Villa</option>
              </select>
              <select
                className="px-3 py-2 border rounded-md text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="FOR_SALE">For Sale</option>
                <option value="PENDING">Pending</option>
                <option value="SOLD">Sold</option>
              </select>
              <Button onClick={() => { setFormData({ ...emptyForm }); setUploadedImages([]); setImageFiles([]); setError(null); setIsAddDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Property
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProperties.map((property) => (
                  <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={getImageUrl(property.images[0])}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getPropertyIcon(property.type)
                      )}
                      <Badge className="absolute top-2 left-2 bg-black/70">{property.type}</Badge>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(property)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDeleteProperty(property)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold line-clamp-1">{property.title}</h3>
                        {getStatusBadge(property.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3" /> {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
                      </p>
                      <p className="text-2xl font-bold text-primary mb-1">{formatCurrency(Number(property.price))}</p>
                      {property.type === 'LAND' && Number(property.pricePerSqm) > 0 && (
                        <p className="text-sm text-green-600 mb-2">
                          {formatCurrency(Number(property.pricePerSqm))}/plot
                        </p>
                      )}
                      {property.type !== 'LAND' ? (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1"><Bed className="w-4 h-4" /> {property.bedrooms || 0}</span>
                          <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {property.bathrooms || 0}</span>
                          <span className="flex items-center gap-1"><Square className="w-4 h-4" /> {formatArea(property.area || 0)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1"><Square className="w-4 h-4" /> {formatArea(property.area || 0)}</span>
                          {property.numberOfPlots && (
                            <span className="flex items-center gap-1"><LandPlot className="w-4 h-4" /> {property.numberOfPlots} plots</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-sm text-muted-foreground">
                          {property.realtor?.user ? `${property.realtor.user.firstName} ${property.realtor.user.lastName}` : 'Unassigned'}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(property)}>
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteProperty(property)}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredProperties.length === 0 && !isLoading && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No properties found.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Property Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>
              Fill in the property details below. Land properties don't require bedroom/bathroom info.
            </DialogDescription>
          </DialogHeader>
          {renderPropertyForm(
            formData,
            setFormData,
            uploadedImages,
            (i) => removeImage(i, false),
            (e) => handleImageUpload(e, false),
            fileInputRef,
            areaUnit,
            setAreaUnit,
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />Add Property</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>
              Update the property details below.
            </DialogDescription>
          </DialogHeader>
          {renderPropertyForm(
            editFormData,
            setEditFormData,
            editUploadedImages,
            (i) => removeImage(i, true),
            (e) => handleImageUpload(e, true),
            editFileInputRef,
            editAreaUnit,
            setEditAreaUnit,
            existingImages,
            removeExistingImage,
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Pencil className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
