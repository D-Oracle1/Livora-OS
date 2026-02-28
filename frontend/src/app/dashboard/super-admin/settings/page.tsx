'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2, Save, User, Palette, Globe, Upload, X,
  Lock, Eye, EyeOff, Shield, Crown, Check, Database,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';
import { getUser, updateUser, getToken } from '@/lib/auth-storage';
import { invalidatePlatformBranding, usePlatformBranding } from '@/hooks/use-platform-branding';

type Tab = 'profile' | 'branding' | 'cms' | 'security';

export default function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatar, setAvatar] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  // Security
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [migratingDb, setMigratingDb] = useState(false);

  // Platform Branding
  const [branding, setBranding] = useState({
    platformName: 'RMS Platform',
    tagline: '',
    logo: '',
    favicon: '',
    primaryColor: '#f59e0b',
  });
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Platform CMS
  const [cms, setCms] = useState({
    heroTitle: '',
    heroSubtitle: '',
    aboutText: '',
    contactEmail: '',
    supportEmail: '',
    contactPhone: '',
    contactAddress: '',
    twitterUrl: '',
    linkedinUrl: '',
    instagramUrl: '',
  });
  const [cmsLoading, setCmsLoading] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: (user as any).phone || '',
      });
      if ((user as any).avatar) setAvatar((user as any).avatar);
    }

    // Load platform settings
    api.get<any>('/master/platform-settings').then((res: any) => {
      const d = res?.data || res;
      if (d?.branding) setBranding(b => ({ ...b, ...d.branding }));
      if (d?.cms) setCms(c => ({ ...c, ...d.cms }));
    }).catch(() => {});
  }, []);

  // ── Profile ──
  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await api.patch<any>('/auth/profile', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
      });
      updateUser(res?.data || res);
      toast.success('Profile updated');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setProfileLoading(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
      const res = await fetch(`${API_BASE}/api/v1/upload/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      const url = (json?.data || json)?.url || (json?.data || json)?.path;
      if (url) {
        setAvatar(url);
        await api.patch('/auth/profile', { avatar: url });
        toast.success('Avatar updated');
      }
    } catch (e: any) { toast.error(e.message || 'Avatar upload failed'); }
    finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

  // ── Master DB Migration ──
  const handleMigrateDb = async () => {
    setMigratingDb(true);
    try {
      const res = await api.post<any>('/master/platform-settings/migrate-db');
      const d = res?.data || res;
      toast.success(d?.message || 'Master database schema is up to date');
    } catch (e: any) {
      toast.error(e.message || 'Migration failed');
    } finally {
      setMigratingDb(false);
    }
  };

  // ── Security ──
  const handleChangePassword = async () => {
    if (passwords.newPass !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.newPass.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.newPass,
      });
      toast.success('Password changed successfully');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) { toast.error(e.message || 'Failed to change password'); }
    finally { setPasswordLoading(false); }
  };

  // ── Branding ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
      const res = await fetch(`${API_BASE}/api/v1/upload/company-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      const url = (json?.data || json)?.url || (json?.data || json)?.path;
      if (url) setBranding(b => ({ ...b, logo: url }));
      else toast.error('Upload failed');
    } catch (e: any) { toast.error(e.message || 'Logo upload failed'); }
    finally {
      setLogoUploading(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
      const res = await fetch(`${API_BASE}/api/v1/upload/company-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      const url = (json?.data || json)?.url || (json?.data || json)?.path;
      if (url) setBranding(b => ({ ...b, favicon: url }));
      else toast.error('Upload failed');
    } catch (e: any) { toast.error(e.message || 'Favicon upload failed'); }
    finally {
      setFaviconUploading(false);
      if (faviconRef.current) faviconRef.current.value = '';
    }
  };

  const handleSaveBranding = async () => {
    setBrandingLoading(true);
    try {
      await api.put('/master/platform-settings/branding', branding);
      invalidatePlatformBranding();
      toast.success('Platform branding saved — refresh sidebar to see changes');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setBrandingLoading(false); }
  };

  const handleSaveCms = async () => {
    setCmsLoading(true);
    try {
      await api.put('/master/platform-settings/cms', cms);
      toast.success('Platform CMS content saved');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setCmsLoading(false); }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'cms', label: 'Platform CMS', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  // Saved platform branding — used as fallback before the user edits the color field
  const savedPlatformBranding = usePlatformBranding();

  // Live accent color: the current (possibly unsaved) primaryColor value so the
  // page gives an immediate preview as the user adjusts the color picker.
  const accent = branding.primaryColor || savedPlatformBranding.primaryColor || '#f59e0b';

  const labelCls = 'text-sm font-medium text-gray-600 block mb-1.5';
  const inputCls = 'w-full h-10 px-3 text-sm neuo-inset outline-none text-gray-800 placeholder:text-gray-400 rounded-xl';
  const sectionTitle = 'text-xs font-bold uppercase tracking-widest mb-3 text-gray-500';

  const SaveBtn = ({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
      style={{ backgroundColor: accent }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {label}
    </button>
  );

  return (
    <div className="max-w-3xl space-y-6 pb-12 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Crown className="w-6 h-6" style={{ color: accent }} /> Platform Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, platform identity, and CMS content</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 neuo-inset rounded-2xl w-full sm:w-fit flex-wrap overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
            style={activeTab === tab.id ? { backgroundColor: accent } : {}}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          <div className="neuo-card p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Personal Information</h2>

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {avatar ? (
                  <img src={getImageUrl(avatar)} alt="avatar" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full border-4 border-white shadow-md flex items-center justify-center"
                    style={{ backgroundColor: `${accent}20` }}
                  >
                    <User className="w-8 h-8" style={{ color: accent }} />
                  </div>
                )}
                {avatar && (
                  <button
                    onClick={() => setAvatar('')}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
              <div>
                <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarUpload} className="hidden" />
                <button
                  onClick={() => avatarRef.current?.click()}
                  disabled={avatarUploading}
                  className="neuo-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50"
                >
                  {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {avatar ? 'Change Photo' : 'Upload Photo'}
                </button>
                <p className="text-xs text-gray-400 mt-1.5">JPG, PNG. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name</label>
                <input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  Email <Badge variant="outline" className="ml-1 text-xs">read-only</Badge>
                </label>
                <input value={profile.email} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="+234 800 000 0000" />
              </div>
            </div>

            <div className="flex justify-end">
              <SaveBtn onClick={handleSaveProfile} loading={profileLoading} label="Save Profile" />
            </div>
          </div>
        </div>
      )}

      {/* ── Platform Branding Tab ── */}
      {activeTab === 'branding' && (
        <div className="neuo-card p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Platform Branding</h2>
            <p className="text-sm text-gray-400 mt-0.5">Controls how the admin dashboard looks and what name/logo appears in the sidebar and platform pages.</p>
          </div>

          {/* Logo */}
          <div>
            <p className={sectionTitle}>Platform Logo</p>
            <div className="flex items-center gap-5">
              {branding.logo ? (
                <div className="relative">
                  <img src={getImageUrl(branding.logo)} alt="logo" className="w-20 h-20 rounded-xl object-contain neuo-inset p-1.5" />
                  <button onClick={() => setBranding(b => ({ ...b, logo: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl neuo-inset flex items-center justify-center">
                  <Palette className="w-7 h-7 text-gray-400" />
                </div>
              )}
              <div>
                <input type="file" accept="image/*" ref={logoRef} onChange={handleLogoUpload} className="hidden" />
                <button onClick={() => logoRef.current?.click()} disabled={logoUploading} className="neuo-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50">
                  {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {branding.logo ? 'Replace Logo' : 'Upload Logo'}
                </button>
                <p className="text-xs text-gray-400 mt-1.5">PNG, SVG, JPG. Recommended 256×256.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls}>Platform Name</label>
              <input value={branding.platformName} onChange={e => setBranding(b => ({ ...b, platformName: e.target.value }))} className={inputCls} placeholder="RMS Platform" />
              <p className="text-xs text-gray-400 mt-1">Shown in the sidebar, platform page, and browser tabs.</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Tagline / Subtitle</label>
              <input value={branding.tagline} onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))} className={inputCls} placeholder="Powering Real Estate Excellence" />
            </div>
            <div>
              <label className={labelCls}>Primary Accent Color</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={branding.primaryColor || '#f59e0b'}
                  onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer bg-transparent p-0.5 shrink-0"
                />
                <input
                  value={branding.primaryColor}
                  onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))}
                  className={`${inputCls} w-32 shrink-0`}
                  placeholder="#f59e0b"
                />
                <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-100 shrink-0" style={{ backgroundColor: accent }} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Favicon</label>
              <div className="flex items-center gap-4">
                {branding.favicon ? (
                  <div className="relative">
                    <img src={getImageUrl(branding.favicon)} alt="favicon" className="w-12 h-12 rounded-lg object-contain neuo-inset p-1" />
                    <button onClick={() => setBranding(b => ({ ...b, favicon: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg neuo-inset flex items-center justify-center">
                    <Globe className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <input type="file" accept="image/x-icon,image/png,image/svg+xml,image/*" ref={faviconRef} onChange={handleFaviconUpload} className="hidden" />
                  <button onClick={() => faviconRef.current?.click()} disabled={faviconUploading} className="neuo-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50">
                    {faviconUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {branding.favicon ? 'Replace Favicon' : 'Upload Favicon'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1.5">ICO, PNG, SVG. Recommended 32×32.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SaveBtn onClick={handleSaveBranding} loading={brandingLoading} label="Save Branding" />
          </div>
        </div>
      )}

      {/* ── Platform CMS Tab ── */}
      {activeTab === 'cms' && (
        <div className="neuo-card p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Platform CMS</h2>
            <p className="text-sm text-gray-400 mt-0.5">Content shown on the public platform landing page.</p>
          </div>

          {/* Hero */}
          <div>
            <p className={sectionTitle}>Hero Section</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Hero Title</label>
                <input value={cms.heroTitle} onChange={e => setCms(c => ({ ...c, heroTitle: e.target.value }))} className={inputCls} placeholder="Manage Your Real Estate Business Like a Pro" />
              </div>
              <div>
                <label className={labelCls}>Hero Subtitle</label>
                <Textarea rows={2} value={cms.heroSubtitle} onChange={e => setCms(c => ({ ...c, heroSubtitle: e.target.value }))} className="neuo-inset rounded-xl text-sm text-gray-800 placeholder:text-gray-400 resize-none border-0 outline-none px-3 py-2.5 w-full" placeholder="One platform for property management, HR, CRM, and more." />
              </div>
            </div>
          </div>

          {/* About */}
          <div>
            <p className={sectionTitle}>About / Description</p>
            <Textarea rows={4} value={cms.aboutText} onChange={e => setCms(c => ({ ...c, aboutText: e.target.value }))} className="neuo-inset rounded-xl text-sm text-gray-800 placeholder:text-gray-400 resize-none border-0 outline-none px-3 py-2.5 w-full" placeholder="Brief description of the RMS platform..." />
          </div>

          {/* Contact */}
          <div>
            <p className={sectionTitle}>Contact & Support</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Contact Email</label>
                <input value={cms.contactEmail} onChange={e => setCms(c => ({ ...c, contactEmail: e.target.value }))} className={inputCls} placeholder="contact@rmsplatform.com" />
              </div>
              <div>
                <label className={labelCls}>Support Email</label>
                <input value={cms.supportEmail} onChange={e => setCms(c => ({ ...c, supportEmail: e.target.value }))} className={inputCls} placeholder="support@rmsplatform.com" />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input value={cms.contactPhone} onChange={e => setCms(c => ({ ...c, contactPhone: e.target.value }))} className={inputCls} placeholder="+234 800 000 0000" />
              </div>
              <div>
                <label className={labelCls}>Office Address</label>
                <input value={cms.contactAddress} onChange={e => setCms(c => ({ ...c, contactAddress: e.target.value }))} className={inputCls} placeholder="123 Platform St, Lagos" />
              </div>
            </div>
          </div>

          {/* Social */}
          <div>
            <p className={sectionTitle}>Social Links</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Twitter / X</label>
                <input value={cms.twitterUrl} onChange={e => setCms(c => ({ ...c, twitterUrl: e.target.value }))} className={inputCls} placeholder="https://twitter.com/..." />
              </div>
              <div>
                <label className={labelCls}>LinkedIn</label>
                <input value={cms.linkedinUrl} onChange={e => setCms(c => ({ ...c, linkedinUrl: e.target.value }))} className={inputCls} placeholder="https://linkedin.com/..." />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input value={cms.instagramUrl} onChange={e => setCms(c => ({ ...c, instagramUrl: e.target.value }))} className={inputCls} placeholder="https://instagram.com/..." />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SaveBtn onClick={handleSaveCms} loading={cmsLoading} label="Save CMS Content" />
          </div>
        </div>
      )}

      {/* ── Security Tab ── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <div className="neuo-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Lock className="w-4 h-4" style={{ color: accent }} /> Change Password
            </h2>

            {[
              { id: 'current' as const, label: 'Current Password', key: 'current' as const },
              { id: 'new' as const, label: 'New Password', key: 'newPass' as const },
              { id: 'confirm' as const, label: 'Confirm New Password', key: 'confirm' as const },
            ].map(f => (
              <div key={f.id}>
                <label className={labelCls}>{f.label}</label>
                <div className="relative">
                  <input
                    type={showPass[f.id] ? 'text' : 'password'}
                    value={passwords[f.key]}
                    onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))}
                    className={`${inputCls} pr-10`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => ({ ...s, [f.id]: !s[f.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass[f.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    passwords.newPass.length === 0 ? 'w-0' :
                    passwords.newPass.length < 6 ? 'w-1/4 bg-red-400' :
                    passwords.newPass.length < 10 ? 'w-1/2 bg-amber-400' :
                    passwords.newPass.length < 14 ? 'w-3/4 bg-blue-400' :
                    'w-full bg-emerald-400'
                  }`}
                />
              </div>
              <span className="text-xs text-gray-400 w-14 text-right">
                {passwords.newPass.length === 0 ? '' :
                 passwords.newPass.length < 6 ? 'Weak' :
                 passwords.newPass.length < 10 ? 'Fair' :
                 passwords.newPass.length < 14 ? 'Good' : 'Strong'}
              </span>
            </div>
            {passwords.confirm && passwords.newPass !== passwords.confirm && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <X className="w-3 h-3" /> Passwords do not match
              </p>
            )}
            {passwords.confirm && passwords.newPass === passwords.confirm && passwords.newPass.length >= 8 && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                <Check className="w-3 h-3" /> Passwords match
              </p>
            )}
            <div className="flex justify-end pt-1">
              <SaveBtn
                onClick={handleChangePassword}
                loading={passwordLoading}
                label="Update Password"
              />
            </div>
          </div>

          <div className="neuo-card p-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-800">Security Status</h2>
            {[
              { label: 'Role', value: 'Super Administrator', icon: Crown, color: accent },
              { label: 'Session', value: 'JWT authenticated', icon: Shield, color: '#10b981' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  {item.label}
                </div>
                <span className="text-sm font-medium text-gray-700">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="neuo-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: accent }} /> Database Management
            </h2>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-700 font-medium">Sync Master DB Schema</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Applies the master database schema (creates missing tables &amp; columns). Safe to run any time — all statements are idempotent.
                </p>
              </div>
              <button
                onClick={handleMigrateDb}
                disabled={migratingDb}
                className="neuo-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50 shrink-0"
              >
                {migratingDb ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                {migratingDb ? 'Syncing...' : 'Sync Schema'}
              </button>
            </div>
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
              This runs automatically on every backend deployment. Use this button only if you need to manually trigger a schema sync.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
