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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
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
            {renderImageField('Background Image', 'backgroundImage')}
            {renderImageField('Hero Image (Right Side)', 'heroImage')}
            {renderDynamicList('Hero Stats', 'stats', [
              { key: 'value', label: 'Value (e.g. 200+)' },
              { key: 'label', label: 'Label (e.g. Premium Properties)' },
            ])}
          </div>
        );

      case 'about':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={sectionData.title || ''} onChange={(e) => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtitle</label>
              <Input value={sectionData.subtitle || ''} onChange={(e) => updateField('subtitle', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Content</label>
              <RichTextEditor content={sectionData.content || ''} onChange={(html) => updateField('content', html)} />
            </div>
            {renderImageField('Section Image', 'image')}
            {renderDynamicList('Bullet Points', 'items', [
              { key: 'text', label: 'Bullet text' },
            ])}
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
          { key: 'label', label: 'Label' },
        ]);

      case 'agents':
        return renderDynamicList('Featured Agents', 'agents', [
          { key: 'name', label: 'Name' },
          { key: 'role', label: 'Role' },
          { key: 'deals', label: 'Deals count' },
          { key: 'rating', label: 'Rating (1-5)' },
          { key: 'image', label: 'Image URL' },
        ]);

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
