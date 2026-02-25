'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail,
  Users,
  UserMinus,
  Search,
  Trash2,
  Send,
  Loader2,
  Download,
  AlertTriangle,
  Plus,
  X,
  Image as ImageIcon,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Building2,
  Eye,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useBranding } from '@/hooks/use-branding';

interface Recipient {
  email: string;
  name?: string | null;
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  subscribedAt: string;
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
}

interface Counts {
  subscribers: number;
  clients: number;
  staff: number;
  realtors: number;
}

interface Attachment {
  filename: string;
  url: string;
}

interface BrandingOptions {
  logoUrl: string;
  companyName: string;
  primaryColor: string;
  address: string;
}

type MainTab = 'lists' | 'compose';
type ListTab = 'SUBSCRIBERS' | 'CLIENTS' | 'STAFF' | 'REALTORS';
type RecipientType = 'SUBSCRIBERS' | 'CLIENTS' | 'STAFF' | 'REALTORS' | 'CUSTOM';

const RECIPIENT_TYPES: { value: RecipientType; label: string; description: string }[] = [
  { value: 'SUBSCRIBERS', label: 'Newsletter Subscribers', description: 'People who opted in to your newsletter' },
  { value: 'CLIENTS', label: 'All Clients', description: 'All active client accounts' },
  { value: 'STAFF', label: 'Staff Members', description: 'All active staff and HR employees' },
  { value: 'REALTORS', label: 'Realtors', description: 'All active realtor accounts' },
  { value: 'CUSTOM', label: 'Custom Emails', description: 'Manually specify recipient email addresses' },
];

export default function NewsletterPage() {
  const tenantBranding = useBranding();

  // ── Main state ──────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('compose');

  // ── Lists tab ───────────────────────────────────────────────────────────────
  const [listTab, setListTab] = useState<ListTab>('SUBSCRIBERS');
  const [listData, setListData] = useState<(Recipient & { id?: string; isActive?: boolean; subscribedAt?: string })[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, unsubscribed: 0 });
  const [counts, setCounts] = useState<Counts>({ subscribers: 0, clients: 0, staff: 0, realtors: 0 });

  // ── Compose tab ─────────────────────────────────────────────────────────────
  const [recipientType, setRecipientType] = useState<RecipientType>('SUBSCRIBERS');
  const [customEmails, setCustomEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<Attachment>({ filename: '', url: '' });
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [branding, setBranding] = useState<BrandingOptions>({
    logoUrl: '',
    companyName: '',
    primaryColor: '#1e40af',
    address: '',
  });
  const [showBranding, setShowBranding] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const raw = await api.get<any>('/newsletter/stats');
      setStats(raw?.data ?? raw);
    } catch {
      // silently fail
    }
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const raw = await api.get<any>('/newsletter/counts');
      setCounts(raw?.data ?? raw);
    } catch {
      // silently fail
    }
  }, []);

  const fetchListData = useCallback(async () => {
    setListLoading(true);
    try {
      if (listTab === 'SUBSCRIBERS') {
        const params = new URLSearchParams({ page: String(listPage), limit: '20' });
        if (listSearch) params.set('search', listSearch);
        const res = await api.get<{ data: any[]; meta: { totalPages: number } }>(
          `/newsletter/subscribers?${params}`,
        );
        setListData(res.data || []);
        setListTotalPages(res.meta?.totalPages || 1);
      } else {
        const raw = await api.get<any>(`/newsletter/recipients?type=${listTab}`);
        // TransformInterceptor wraps { count, data } → { success, data: { count, data }, timestamp }
        const inner = raw?.data ?? raw;
        const arr: Recipient[] = Array.isArray(inner) ? inner : (inner?.data ?? []);
        const filtered = listSearch
          ? arr.filter(
              (r) =>
                r.email.toLowerCase().includes(listSearch.toLowerCase()) ||
                (r.name && r.name.toLowerCase().includes(listSearch.toLowerCase())),
            )
          : arr;
        setListData(filtered);
        setListTotalPages(1);
      }
    } catch {
      toast.error('Failed to load recipients');
    } finally {
      setListLoading(false);
    }
  }, [listTab, listPage, listSearch]);

  useEffect(() => {
    fetchStats();
    fetchCounts();
  }, [fetchStats, fetchCounts]);

  // Pre-populate branding from tenant settings (only when fields are still empty)
  useEffect(() => {
    setBranding((prev) => ({
      logoUrl: prev.logoUrl || tenantBranding.logo || '',
      companyName: prev.companyName || tenantBranding.companyName || '',
      primaryColor: prev.primaryColor !== '#1e40af' ? prev.primaryColor : (tenantBranding.primaryColor || '#1e40af'),
      address: prev.address,
    }));
  }, [tenantBranding.companyName, tenantBranding.logo, tenantBranding.primaryColor]);

  useEffect(() => {
    if (mainTab === 'lists') {
      fetchListData();
    }
  }, [mainTab, fetchListData]);

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('Remove this subscriber permanently?')) return;
    try {
      await api.delete(`/newsletter/subscribers/${id}`);
      toast.success('Subscriber removed');
      fetchListData();
      fetchStats();
      fetchCounts();
    } catch {
      toast.error('Failed to delete subscriber');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Email', 'Name'];
    const csvContent = [
      headers.join(','),
      ...listData.map((r) => [`"${r.email}"`, `"${r.name || ''}"`].join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${listTab.toLowerCase()}-emails-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  // ── Logo upload ──────────────────────────────────────────────────────────────
  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const result = await api.uploadFiles('/upload/company-logo', [file], 'logo');
      const url: string = Array.isArray(result) ? result[0] : (result as any)?.url || result;
      setBranding((b) => ({ ...b, logoUrl: url }));
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Image handling ───────────────────────────────────────────────────────────
  const addImage = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
    setShowImageInput(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Attachment handling ──────────────────────────────────────────────────────
  const addAttachment = () => {
    if (!newAttachment.filename.trim() || !newAttachment.url.trim()) return;
    setAttachments((prev) => [...prev, { ...newAttachment }]);
    setNewAttachment({ filename: '', url: '' });
    setShowAttachmentInput(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Send email ───────────────────────────────────────────────────────────────
  const buildFinalContent = () => {
    let finalContent = content;
    if (images.length > 0) {
      finalContent +=
        '<div style="margin-top:16px;">' +
        images
          .map(
            (url) =>
              `<p style="margin:8px 0;"><img src="${url}" alt="image" style="max-width:100%;height:auto;border-radius:6px;display:block;" /></p>`,
          )
          .join('') +
        '</div>';
    }
    return finalContent;
  };

  const getRecipientCount = () => {
    switch (recipientType) {
      case 'SUBSCRIBERS':
        return counts.subscribers;
      case 'CLIENTS':
        return counts.clients;
      case 'STAFF':
        return counts.staff;
      case 'REALTORS':
        return counts.realtors;
      case 'CUSTOM': {
        const emails = customEmails
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter((e) => e.includes('@'));
        return emails.length;
      }
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error('Subject and content are required');
      return;
    }
    if (recipientType === 'CUSTOM') {
      const emails = customEmails
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
      if (emails.length === 0) {
        toast.error('Please enter at least one email address');
        return;
      }
    }
    setSending(true);
    try {
      const specificEmails =
        recipientType === 'CUSTOM'
          ? customEmails
              .split(/[\n,;]+/)
              .map((e) => e.trim())
              .filter((e) => e.includes('@'))
          : undefined;

      const res = await api.post<{ message: string; sent: number }>('/newsletter/send', {
        subject,
        content: buildFinalContent(),
        recipientType,
        specificEmails,
        attachments: attachments.length > 0 ? attachments : undefined,
        branding:
          branding.companyName || branding.logoUrl || branding.address
            ? {
                companyName: branding.companyName || undefined,
                logoUrl: branding.logoUrl || undefined,
                primaryColor: branding.primaryColor || undefined,
                address: branding.address || undefined,
              }
            : undefined,
      });
      toast.success(res.message || `Email sent to ${res.sent} recipients`);
      setSubject('');
      setContent('');
      setImages([]);
      setAttachments([]);
      setShowConfirm(false);
      fetchCounts();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  // ── Branded preview ──────────────────────────────────────────────────────────
  const primaryColor = branding.primaryColor || '#1e40af';
  const companyName = branding.companyName || 'Your Company';

  // ── List tab labels ──────────────────────────────────────────────────────────
  const listTabs: { value: ListTab; label: string; count: number }[] = [
    { value: 'SUBSCRIBERS', label: 'Newsletter Subscribers', count: stats.active },
    { value: 'CLIENTS', label: 'Clients', count: counts.clients },
    { value: 'STAFF', label: 'Staff', count: counts.staff },
    { value: 'REALTORS', label: 'Realtors', count: counts.realtors },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Newsletter Subscribers', value: stats.active, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Clients', value: counts.clients, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Staff Members', value: counts.staff, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Realtors', value: counts.realtors, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {[
          { value: 'compose' as MainTab, label: 'Compose & Send', icon: Send },
          { value: 'lists' as MainTab, label: 'Email Lists', icon: Users },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMainTab(value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ────────────────── COMPOSE TAB ────────────────── */}
      {mainTab === 'compose' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="xl:col-span-3 space-y-4">
            {/* Recipient Type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Send To
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {RECIPIENT_TYPES.map((rt) => {
                  const count =
                    rt.value === 'SUBSCRIBERS'
                      ? counts.subscribers
                      : rt.value === 'CLIENTS'
                        ? counts.clients
                        : rt.value === 'STAFF'
                          ? counts.staff
                          : rt.value === 'REALTORS'
                            ? counts.realtors
                            : null;
                  return (
                    <label
                      key={rt.value}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        recipientType === rt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="recipientType"
                          value={rt.value}
                          checked={recipientType === rt.value}
                          onChange={() => setRecipientType(rt.value)}
                          className="accent-primary"
                        />
                        <div>
                          <p className="text-sm font-medium">{rt.label}</p>
                          <p className="text-xs text-muted-foreground">{rt.description}</p>
                        </div>
                      </div>
                      {count !== null && (
                        <Badge variant="secondary" className="shrink-0">
                          {count}
                        </Badge>
                      )}
                    </label>
                  );
                })}

                {recipientType === 'CUSTOM' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium mb-1 block">
                      Email Addresses
                      <span className="text-muted-foreground font-normal ml-1">(one per line, or comma-separated)</span>
                    </label>
                    <textarea
                      className="w-full h-28 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="john@example.com&#10;jane@example.com&#10;..."
                      value={customEmails}
                      onChange={(e) => setCustomEmails(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {customEmails
                        .split(/[\n,;]+/)
                        .map((e) => e.trim())
                        .filter((e) => e.includes('@')).length}{' '}
                      valid addresses
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setShowBranding((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Company Branding (Letterhead)</span>
                  {(branding.companyName || branding.logoUrl) && (
                    <Badge variant="outline" className="text-xs">
                      Configured
                    </Badge>
                  )}
                </div>
                {showBranding ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showBranding && (
                <CardContent className="pt-0 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium mb-1 block">Company Name</label>
                    <Input
                      placeholder="Acme Real Estate"
                      value={branding.companyName}
                      onChange={(e) => setBranding((b) => ({ ...b, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium mb-1 block">Company Logo</label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = '';
                      }}
                    />
                    {branding.logoUrl ? (
                      <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                        <img
                          src={branding.logoUrl}
                          alt="logo"
                          className="h-10 w-auto object-contain rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{branding.logoUrl}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Replace'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setBranding((b) => ({ ...b, logoUrl: '' }))}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="w-full flex flex-col items-center justify-center gap-1.5 p-4 border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                        <span className="text-xs">{uploadingLogo ? 'Uploading...' : 'Click to upload logo'}</span>
                        <span className="text-xs opacity-60">PNG, JPG, WEBP up to 5MB</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                        className="h-9 w-12 rounded border cursor-pointer"
                      />
                      <Input
                        value={branding.primaryColor}
                        onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                        className="flex-1"
                        placeholder="#1e40af"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Company Address</label>
                    <Input
                      placeholder="123 Main St, Lagos, Nigeria"
                      value={branding.address}
                      onChange={(e) => setBranding((b) => ({ ...b, address: e.target.value }))}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium mb-1 block">Subject *</label>
              <Input
                placeholder="Your email subject line..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Content */}
            <div>
              <label className="text-sm font-medium mb-1 block">Email Body *</label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write your email content here..."
                className="min-h-[240px]"
              />
            </div>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Images</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageInput((v) => !v)}
                >
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  Add Image URL
                </Button>
              </div>
              {showImageInput && (
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addImage()}
                  />
                  <Button type="button" onClick={addImage} size="sm">
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowImageInput(false);
                      setNewImageUrl('');
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {images.length > 0 && (
                <div className="space-y-2">
                  {images.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <img
                        src={url}
                        alt={`image-${i}`}
                        className="w-12 h-12 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <p className="text-xs text-muted-foreground flex-1 truncate">{url}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeImage(i)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Attachments</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAttachmentInput((v) => !v)}
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                  Add Attachment
                </Button>
              </div>
              {showAttachmentInput && (
                <div className="p-3 border rounded-lg space-y-2 mb-2">
                  <Input
                    placeholder="Filename (e.g. brochure.pdf)"
                    value={newAttachment.filename}
                    onChange={(e) => setNewAttachment((a) => ({ ...a, filename: e.target.value }))}
                  />
                  <Input
                    placeholder="File URL (https://...)"
                    value={newAttachment.url}
                    onChange={(e) => setNewAttachment((a) => ({ ...a, url: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={addAttachment}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAttachmentInput(false);
                        setNewAttachment({ filename: '', url: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.filename}</p>
                        <p className="text-xs text-muted-foreground truncate">{att.url}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(i)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <div className="pt-2">
              {!showConfirm ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!subject.trim() || !content.trim()) {
                      toast.error('Subject and content are required');
                      return;
                    }
                    if (recipientType === 'CUSTOM') {
                      const emails = customEmails
                        .split(/[\n,;]+/)
                        .map((e) => e.trim())
                        .filter((e) => e.includes('@'));
                      if (emails.length === 0) {
                        toast.error('Please enter at least one email address');
                        return;
                      }
                    }
                    setShowConfirm(true);
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to {getRecipientCount()} Recipient{getRecipientCount() !== 1 ? 's' : ''}
                </Button>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Send &ldquo;{subject}&rdquo; to {getRecipientCount()} recipient
                        {getRecipientCount() !== 1 ? 's' : ''}?
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowConfirm(false)}
                      disabled={sending}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" onClick={handleSend} disabled={sending}>
                      {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {sending ? 'Sending...' : 'Confirm Send'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="xl:col-span-2">
            <div className="sticky top-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Email Preview</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview((v) => !v)}
                  className="text-xs"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  {showPreview ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden shadow-sm bg-gray-100">
                {/* Email Header */}
                <div
                  style={{ backgroundColor: primaryColor }}
                  className="p-5 text-center"
                >
                  {branding.logoUrl && (
                    <img
                      src={branding.logoUrl}
                      alt="logo"
                      className="h-10 object-contain mx-auto mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <h2 className="text-white font-bold text-lg m-0">{companyName}</h2>
                </div>
                {/* Email Body */}
                <div className="bg-white p-5">
                  {content ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-800"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  ) : (
                    <p className="text-gray-400 text-sm italic">Your content will appear here...</p>
                  )}
                  {images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {images.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`img-${i}`}
                          className="max-w-full h-auto rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="bg-white px-5 pb-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 mt-3 mb-1">Attachments:</p>
                    {attachments.map((a, i) => (
                      <p key={i} className="text-xs text-blue-600">
                        📎 {a.filename}
                      </p>
                    ))}
                  </div>
                )}
                {/* Email Footer */}
                <div className="bg-gray-50 px-5 py-4 text-center border-t border-gray-200">
                  {branding.address && (
                    <p className="text-xs text-gray-400 mb-1">{branding.address}</p>
                  )}
                  <p className="text-xs text-gray-300">
                    You received this because you are subscribed.{' '}
                    <span className="underline text-gray-400">Unsubscribe</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── LISTS TAB ────────────────── */}
      {mainTab === 'lists' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-1 flex-wrap">
                {listTabs.map((lt) => (
                  <button
                    key={lt.value}
                    onClick={() => {
                      setListTab(lt.value);
                      setListSearch('');
                      setListPage(1);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      listTab === lt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {lt.label}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        listTab === lt.value ? 'bg-white/20' : 'bg-muted'
                      }`}
                    >
                      {lt.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 w-56"
                    value={listSearch}
                    onChange={(e) => {
                      setListSearch(e.target.value);
                      setListPage(1);
                    }}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : listData.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">No records found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                        {listTab === 'SUBSCRIBERS' && (
                          <>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Subscribed</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {listData.map((row, i) => (
                        <tr key={(row as any).id || i} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-3 px-4 font-medium">{row.email}</td>
                          <td className="py-3 px-4 text-muted-foreground">{row.name || '—'}</td>
                          {listTab === 'SUBSCRIBERS' && (
                            <>
                              <td className="py-3 px-4">
                                {(row as any).isActive ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Unsubscribed</Badge>
                                )}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {(row as any).subscribedAt
                                  ? new Date((row as any).subscribedAt).toLocaleDateString()
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSubscriber((row as any).id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {listTab === 'SUBSCRIBERS' && listTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={listPage <= 1}
                      onClick={() => setListPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {listPage} of {listTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={listPage >= listTotalPages}
                      onClick={() => setListPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
