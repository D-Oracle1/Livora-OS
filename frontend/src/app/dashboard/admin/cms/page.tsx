'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Info,
  Target,
  Heart,
  Zap,
  Settings,
  BarChart3,
  Users,
  Megaphone,
  Phone,
  LayoutDashboard,
  Palette,
  Loader2,
  Save,
  Plus,
  Trash2,
  Upload,
  Landmark,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { resetBrandingCache } from '@/hooks/use-branding';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { cn } from '@/lib/utils';


const TABS = [
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'hero', label: 'Hero', icon: Home },
  { id: 'about', label: 'About Us', icon: Info },
  { id: 'mission', label: 'Mission & Vision', icon: Target },
  { id: 'core_values', label: 'Core Values', icon: Heart },
  { id: 'features', label: 'Features', icon: Zap },
  { id: 'platform_features', label: 'Platform Features', icon: Settings },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
  { id: 'agents', label: 'Featured Agents', icon: Users },
  { id: 'cta', label: 'Call to Action', icon: Megaphone },
  { id: 'contact', label: 'Contact Info', icon: Phone },
  { id: 'footer', label: 'Footer', icon: LayoutDashboard },
  { id: 'payment', label: 'Payment Info', icon: Landmark },
];

export default function CmsPage() {
  const visibleTabs = TABS;
  const [activeTab, setActiveTab] = useState('branding');
  const [sectionData, setSectionData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSection = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/cms/sections/${key}`);
      const data = res?.data !== undefined ? res.data : res;
      setSectionData(data || {});
    } catch {
      setSectionData({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSection(activeTab);
  }, [activeTab, fetchSection]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/cms/sections/${activeTab}`, { content: sectionData });
      toast.success('Section saved successfully!');
      if (activeTab === 'branding') resetBrandingCache();
    } catch {
      toast.error('Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setSectionData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (field: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const urls = await api.uploadFiles('/upload/cms-images', [file], 'images');
        if (urls && urls.length > 0) {
          updateField(field, urls[0]);
          toast.success('Image uploaded');
        }
      } catch {
        toast.error('Failed to upload image');
      }
    };
    input.click();
  };

  const renderImageField = (label: string, field: string) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="flex items-center gap-3">
        {sectionData[field] && (
          <img
            src={sectionData[field]?.startsWith('http') ? sectionData[field] : getImageUrl(sectionData[field])}
            alt={label}
            className="w-20 h-20 object-cover rounded-lg border"
          />
        )}
        <Button variant="outline" size="sm" onClick={() => handleImageUpload(field)}>
          <Upload className="w-4 h-4 mr-2" />
          {sectionData[field] ? 'Change' : 'Upload'}
        </Button>
        <Input
          placeholder="Or paste image URL"
          value={sectionData[field] || ''}
          onChange={(e) => updateField(field, e.target.value)}
          className="flex-1"
        />
      </div>
    </div>
  );

  const handleSideCarouselImageAdd = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const urls = await api.uploadFiles('/upload/cms-images', [file], 'images');
        if (urls && urls.length > 0) {
          const existing: string[] = Array.isArray(sectionData.heroImages) ? sectionData.heroImages : [];
          updateField('heroImages', [...existing, urls[0]]);
          toast.success('Image added to side carousel');
        }
      } catch {
        toast.error('Failed to upload image');
      }
    };
    input.click();
  };

  const renderSideCarouselImages = () => {
    const images: string[] = Array.isArray(sectionData.heroImages) ? sectionData.heroImages : [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Right-Side Carousel Images ({images.length})</label>
          <Button variant="outline" size="sm" onClick={handleSideCarouselImageAdd} disabled={images.length >= 10}>
            <Plus className="w-4 h-4 mr-1" /> Add Image
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Add 2–10 images for the right-side carousel. Falls back to single Hero Image if empty.</p>
        {images.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
            No side carousel images yet. Click Add Image to start.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((img: string, idx: number) => (
              <div key={idx} className="relative group">
                <img
                  src={img.startsWith('http') ? img : getImageUrl(img)}
                  alt={`Side slide ${idx + 1}`}
                  className="w-full h-24 object-cover rounded-lg border"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <span className="text-white text-xs font-medium">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/40"
                    onClick={() => updateField('heroImages', images.filter((_: string, i: number) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleCarouselImageAdd = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const urls = await api.uploadFiles('/upload/cms-images', [file], 'images');
        if (urls && urls.length > 0) {
          const existing: string[] = Array.isArray(sectionData.backgroundImages) ? sectionData.backgroundImages : [];
          updateField('backgroundImages', [...existing, urls[0]]);
          toast.success('Image added to carousel');
        }
      } catch {
        toast.error('Failed to upload image');
      }
    };
    input.click();
  };

  const renderCarouselImages = () => {
    const images: string[] = Array.isArray(sectionData.backgroundImages) ? sectionData.backgroundImages : [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Carousel Background Images ({images.length})</label>
          <Button variant="outline" size="sm" onClick={handleCarouselImageAdd} disabled={images.length >= 10}>
            <Plus className="w-4 h-4 mr-1" /> Add Image
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Add 2–10 images to enable the carousel. Falls back to single Background Image if empty.</p>
        {images.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
            No carousel images yet. Click Add Image to start.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((img: string, idx: number) => (
              <div key={idx} className="relative group">
                <img
                  src={img.startsWith('http') ? img : getImageUrl(img)}
                  alt={`Slide ${idx + 1}`}
                  className="w-full h-24 object-cover rounded-lg border"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <span className="text-white text-xs font-medium">#{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/40"
                    onClick={() => updateField('backgroundImages', images.filter((_: string, i: number) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDynamicList = (
    label: string,
    field: string,
    fields: { key: string; label: string; type?: 'text' | 'textarea' | 'image' }[],
  ) => {
    const items: any[] = sectionData[field] || [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">{label}</label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const empty: any = {};
              fields.forEach((f) => (empty[f.key] = ''));
              updateField(field, [...items, empty]);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 text-red-500 hover:text-red-700"
                onClick={() => updateField(field, items.filter((_: any, i: number) => i !== idx))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      value={item[f.key] || ''}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], [f.key]: e.target.value };
                        updateField(field, updated);
                      }}
                      rows={2}
                    />
                  ) : (
                    <Input
                      value={item[f.key] || ''}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], [f.key]: e.target.value };
                        updateField(field, updated);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (activeTab) {
      case 'branding':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Company name, logo, and brand colour are managed by the platform administrator. Contact your RMS Platform support to update them.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Contact & Communication</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Support Email</label>
                    <Input value={sectionData.supportEmail || ''} onChange={(e) => updateField('supportEmail', e.target.value)} placeholder="support@company.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Support Phone</label>
                    <Input value={sectionData.supportPhone || ''} onChange={(e) => updateField('supportPhone', e.target.value)} placeholder="+234XXXXXXXXXX" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company Address</label>
                  <Input value={sectionData.address || ''} onChange={(e) => updateField('address', e.target.value)} placeholder="Lagos, Nigeria" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">WhatsApp Number</label>
                  <Input value={sectionData.whatsappNumber || ''} onChange={(e) => updateField('whatsappNumber', e.target.value)} placeholder="+234XXXXXXXXXX" />
                  <p className="text-xs text-muted-foreground mt-1">International format with country code. Used as fallback if no link is set.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">WhatsApp Link (Full URL)</label>
                  <Input value={sectionData.whatsappLink || ''} onChange={(e) => updateField('whatsappLink', e.target.value)} placeholder="https://wa.me/234XXXXXXXXXX" />
                  <p className="text-xs text-muted-foreground mt-1">Paste your full WhatsApp or WhatsApp Business link. This is what opens when users click the WhatsApp icon on the support widget.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Receipt &amp; Document Branding</h3>
              <p className="text-xs text-muted-foreground mb-4">These fields apply <strong>only to receipts and PDF documents</strong> — they are architecturally separate from your platform logo and company name above.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Receipt Header Logo</label>
                  <div className="flex items-center gap-3">
                    {sectionData.receiptHeaderLogo && (
                      <img src={sectionData.receiptHeaderLogo?.startsWith('http') ? sectionData.receiptHeaderLogo : getImageUrl(sectionData.receiptHeaderLogo)} alt="Receipt header logo" className="h-14 w-auto object-contain rounded border bg-gray-50 px-2" />
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleImageUpload('receiptHeaderLogo')}>
                      <Upload className="w-4 h-4 mr-2" />
                      {sectionData.receiptHeaderLogo ? 'Change' : 'Upload'}
                    </Button>
                    <Input placeholder="Or paste image URL" value={sectionData.receiptHeaderLogo || ''} onChange={(e) => updateField('receiptHeaderLogo', e.target.value)} className="flex-1" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Top-left logo on all receipts. Independent of the platform logo shown in the dashboard/website.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Receipt Company Name</label>
                  <Input value={sectionData.receiptCompanyName || ''} onChange={(e) => updateField('receiptCompanyName', e.target.value)} placeholder="e.g. PRINCY & EDDY PROPERTIES" />
                  <p className="text-xs text-muted-foreground mt-1">Name shown at the top of all receipts. Falls back to your general company name if left empty.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Receipt Watermark Logo</label>
                    <div className="flex items-center gap-2">
                      {sectionData.receiptWatermarkLogo && (
                        <img src={sectionData.receiptWatermarkLogo?.startsWith('http') ? sectionData.receiptWatermarkLogo : getImageUrl(sectionData.receiptWatermarkLogo)} alt="Watermark" className="h-10 w-auto object-contain rounded border bg-gray-50 px-1" />
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleImageUpload('receiptWatermarkLogo')}>
                        <Upload className="w-4 h-4 mr-1" />
                        {sectionData.receiptWatermarkLogo ? 'Change' : 'Upload'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Optional. Falls back to receipt header logo, then platform logo.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Watermark Opacity (%)</label>
                    <Input
                      type="number" min="0" max="20"
                      value={sectionData.watermarkOpacity ?? 4}
                      onChange={(e) => updateField('watermarkOpacity', Math.min(20, Math.max(0, Number(e.target.value))))}
                      placeholder="4"
                    />
                    <p className="text-xs text-muted-foreground mt-1">0 = hidden, 4 = subtle (default), 10 = visible.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">RC Number</label>
                    <Input value={sectionData.rcNumber || ''} onChange={(e) => updateField('rcNumber', e.target.value)} placeholder="e.g. 7379240" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Payment Method</label>
                    <Input value={sectionData.paymentMethod || ''} onChange={(e) => updateField('paymentMethod', e.target.value)} placeholder="e.g. Bank Transfer" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Account Name</label>
                    <Input value={sectionData.accountName || ''} onChange={(e) => updateField('accountName', e.target.value)} placeholder="e.g. Princy And Eddy Resources Nigeria Limited" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Account Number</label>
                    <Input value={sectionData.accountNumber || ''} onChange={(e) => updateField('accountNumber', e.target.value)} placeholder="e.g. 1311025917" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Bank Name</label>
                  <Input value={sectionData.bankName || ''} onChange={(e) => updateField('bankName', e.target.value)} placeholder="e.g. Zenith Bank" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Signatory Name</label>
                    <Input value={sectionData.signatoryName || ''} onChange={(e) => updateField('signatoryName', e.target.value)} placeholder="e.g. Daniel Onyekachi Onwuegbuchu" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Signatory Title</label>
                    <Input value={sectionData.signatoryTitle || ''} onChange={(e) => updateField('signatoryTitle', e.target.value)} placeholder="e.g. Admin Manager" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Signature Image</label>
                  <div className="flex items-center gap-3">
                    {sectionData.signatureImage && (
                      <img src={sectionData.signatureImage?.startsWith('http') ? sectionData.signatureImage : getImageUrl(sectionData.signatureImage)} alt="Signature" className="h-16 w-auto object-contain rounded border bg-gray-50 px-2" />
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleImageUpload('signatureImage')}>
                      <Upload className="w-4 h-4 mr-2" />
                      {sectionData.signatureImage ? 'Change' : 'Upload'}
                    </Button>
                    <Input placeholder="Or paste image URL" value={sectionData.signatureImage || ''} onChange={(e) => updateField('signatureImage', e.target.value)} className="flex-1" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Optional. Appears above the signature line on receipts. Upload on a white/transparent background.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Receipt Footer Logo</label>
                  <div className="flex items-center gap-3">
                    {sectionData.receiptLogo && (
                      <img src={sectionData.receiptLogo?.startsWith('http') ? sectionData.receiptLogo : sectionData.receiptLogo} alt="Receipt logo" className="w-20 h-20 object-contain rounded-lg border bg-gray-50" />
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleImageUpload('receiptLogo')}>
                      <Upload className="w-4 h-4 mr-2" />
                      {sectionData.receiptLogo ? 'Change' : 'Upload'}
                    </Button>
                    <Input placeholder="Or paste image URL" value={sectionData.receiptLogo || ''} onChange={(e) => updateField('receiptLogo', e.target.value)} className="flex-1" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Logo shown at the bottom-right of every receipt. Falls back to main company logo if empty.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'hero':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={sectionData.title || ''} onChange={(e) => updateField('title', e.target.value)} placeholder="Search Properties" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Title Accent</label>
              <Input value={sectionData.titleAccent || ''} onChange={(e) => updateField('titleAccent', e.target.value)} placeholder="with Ease" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtitle</label>
              <Textarea value={sectionData.subtitle || ''} onChange={(e) => updateField('subtitle', e.target.value)} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Badge Text</label>
              <Input value={sectionData.badgeText || ''} onChange={(e) => updateField('badgeText', e.target.value)} />
            </div>
            {renderCarouselImages()}
            {renderImageField('Fallback Background Image (single)', 'backgroundImage')}
            {renderSideCarouselImages()}
            {renderImageField('Fallback Hero Image — Right Side (single)', 'heroImage')}
            {renderDynamicList('Hero Stats', 'stats', [
              { key: 'value', label: 'Value (e.g. 200+)' },
              { key: 'label', label: 'Label (e.g. Premium Properties)' },
            ])}
          </div>
        );

      case 'about':
        return (
          <div className="space-y-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400">Fields here map to the About Us page sections. Scroll down to find all editable areas.</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">Hero & Intro</h3>
              <div>
                <label className="text-sm font-medium mb-1 block">Page Title (hero heading)</label>
                <Input value={sectionData.title || ''} onChange={(e) => updateField('title', e.target.value)} placeholder="About Our Company" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Subtitle</label>
                <Input value={sectionData.subtitle || ''} onChange={(e) => updateField('subtitle', e.target.value)} placeholder="About Us" />
              </div>
              {renderImageField('Hero / Main Image (left panel)', 'image')}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">3-Column Intro Text</h3>
              <div>
                <label className="text-sm font-medium mb-1 block">Bold Headline (col 1)</label>
                <Input value={sectionData.storyTitle || ''} onChange={(e) => updateField('storyTitle', e.target.value)} placeholder="Where Trust Meets Real Estate" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">First Paragraph + Read More (col 2)</label>
                <RichTextEditor content={sectionData.content || ''} onChange={(html) => updateField('content', html)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Second Paragraph (col 3)</label>
                <Textarea rows={4} value={sectionData.story || ''} onChange={(e) => updateField('story', e.target.value)} placeholder="Our mission is to deliver unmatched value…" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">Split Image Panel</h3>
              {renderImageField('Right Panel Image (top)', 'storyImage')}
              <p className="text-xs text-muted-foreground">The left panel reuses the Hero image above. The right panel shows this image on top and the hero image again on the bottom.</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm border-b pb-2">Solutions / Services Section</h3>
              <div>
                <label className="text-sm font-medium mb-1 block">Section Heading</label>
                <Input value={sectionData.whyTitle || ''} onChange={(e) => updateField('whyTitle', e.target.value)} placeholder="We Provide Solutions For Your Real Estate Goals" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Section Subtext</label>
                <Textarea rows={2} value={sectionData.whySubtitle || ''} onChange={(e) => updateField('whySubtitle', e.target.value)} placeholder="Our expert team covers every aspect of real estate…" />
              </div>
              {renderDynamicList('Service Items (up to 6, shown in grid)', 'items', [
                { key: 'title', label: 'Title' },
                { key: 'description', label: 'Description', type: 'textarea' },
              ])}
            </div>
          </div>
        );

      case 'mission':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Mission Statement</h3>
              <Input value={sectionData.missionTitle || ''} onChange={(e) => updateField('missionTitle', e.target.value)} placeholder="Our Mission" />
              <RichTextEditor content={sectionData.missionContent || ''} onChange={(html) => updateField('missionContent', html)} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Vision Statement</h3>
              <Input value={sectionData.visionTitle || ''} onChange={(e) => updateField('visionTitle', e.target.value)} placeholder="Our Vision" />
              <RichTextEditor content={sectionData.visionContent || ''} onChange={(html) => updateField('visionContent', html)} />
            </div>
          </div>
        );

      case 'core_values':
        return renderDynamicList('Core Values', 'values', [
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'icon', label: 'Icon name (e.g. Shield, Heart, Lightbulb)' },
        ]);

      case 'features':
        return renderDynamicList('Main Features', 'features', [
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'image', label: 'Image URL' },
        ]);

      case 'platform_features':
        return renderDynamicList('Platform Features', 'features', [
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'icon', label: 'Icon name' },
        ]);

      case 'stats':
        return renderDynamicList('Statistics', 'stats', [
          { key: 'value', label: 'Value (e.g. 10K+)' },
          { key: 'label', label: 'Label (e.g. Happy Customers)' },
          { key: 'description', label: 'Description (shown beside the number on About page)', type: 'textarea' },
        ]);

      case 'agents':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Team Section Subtitle</label>
              <Textarea
                rows={2}
                value={sectionData.subtitle || ''}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="Behind every successful transaction is a dedicated professional who genuinely cares…"
              />
            </div>
            {renderDynamicList('Team Members (first 3 shown on About page)', 'agents', [
              { key: 'name', label: 'Full Name' },
              { key: 'role', label: 'Role / Title' },
              { key: 'deals', label: 'Deals count' },
              { key: 'rating', label: 'Rating (1-5)' },
              { key: 'image', label: 'Photo URL' },
            ])}
          </div>
        );

      case 'cta':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={sectionData.title || ''} onChange={(e) => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtitle</label>
              <Textarea value={sectionData.subtitle || ''} onChange={(e) => updateField('subtitle', e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Primary Button Text</label>
                <Input value={sectionData.primaryButtonText || ''} onChange={(e) => updateField('primaryButtonText', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Primary Button Link</label>
                <Input value={sectionData.primaryButtonLink || ''} onChange={(e) => updateField('primaryButtonLink', e.target.value)} placeholder="/auth/register" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Secondary Button Text</label>
                <Input value={sectionData.secondaryButtonText || ''} onChange={(e) => updateField('secondaryButtonText', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Secondary Button Link</label>
                <Input value={sectionData.secondaryButtonLink || ''} onChange={(e) => updateField('secondaryButtonLink', e.target.value)} placeholder="/contact" />
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={sectionData.phone || ''} onChange={(e) => updateField('phone', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input value={sectionData.email || ''} onChange={(e) => updateField('email', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Textarea value={sectionData.address || ''} onChange={(e) => updateField('address', e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Working Hours</label>
              <Input value={sectionData.hours || ''} onChange={(e) => updateField('hours', e.target.value)} />
            </div>
          </div>
        );

      case 'footer':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Company Description</label>
              <Textarea value={sectionData.description || ''} onChange={(e) => updateField('description', e.target.value)} rows={3} />
            </div>
            {renderDynamicList('Quick Links', 'quickLinks', [
              { key: 'label', label: 'Label' },
              { key: 'href', label: 'URL' },
            ])}
            {renderDynamicList('Services', 'services', [
              { key: 'name', label: 'Service name' },
            ])}
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These details are shown to clients on the purchase flow so they know where to transfer payment.
            </p>
            <div>
              <label className="text-sm font-medium mb-1 block">Bank Name</label>
              <Input
                placeholder="e.g. First Bank of Nigeria"
                value={sectionData.bankName || ''}
                onChange={(e) => updateField('bankName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Account Name</label>
              <Input
                placeholder="e.g. Easyland Properties Ltd"
                value={sectionData.accountName || ''}
                onChange={(e) => updateField('accountName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Account Number</label>
              <Input
                placeholder="e.g. 0123456789"
                value={sectionData.accountNumber || ''}
                onChange={(e) => updateField('accountNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bank Branch (optional)</label>
              <Input
                placeholder="e.g. Ikeja Branch"
                value={sectionData.bankBranch || ''}
                onChange={(e) => updateField('bankBranch', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Additional Instructions (optional)</label>
              <Textarea
                placeholder="e.g. Use the property title as your payment reference."
                rows={3}
                value={sectionData.additionalInfo || ''}
                onChange={(e) => updateField('additionalInfo', e.target.value)}
              />
            </div>
          </div>
        );

      default:
        return <p className="text-muted-foreground">Select a section to edit.</p>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Management</h1>
          <p className="text-muted-foreground">Manage your website pages and content</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="w-full md:w-56 shrink-0 flex md:block overflow-x-auto md:overflow-x-visible gap-1 md:space-y-1 pb-2 md:pb-0">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Editor area */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const tab = TABS.find((t) => t.id === activeTab);
                if (!tab) return null;
                const Icon = tab.icon;
                return (
                  <>
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderEditor()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
