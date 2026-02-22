'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2, Save, User, Palette, Globe, Upload, X,
  Lock, Eye, EyeOff, Shield, Crown, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const logoRef = useRef<HTMLInputElement>(null);

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
  const accentColor = branding.primaryColor || savedPlatformBranding.primaryColor || '#f59e0b';
  const accentStyle = { color: accentColor } as React.CSSProperties;
  const accentBtnStyle = { backgroundColor: accentColor, borderColor: accentColor } as React.CSSProperties;

  const inputCls = 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500/40';
  const labelCls = 'text-sm font-medium text-slate-300 block mb-1.5';
  const sectionTitle = 'text-xs font-bold uppercase tracking-widest mb-3';

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crown className="w-6 h-6" style={accentStyle} /> Platform Settings
        </h1>
        <p className="text-slate-400 text-sm mt-1">Manage your profile, platform identity, and CMS content</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'text-slate-900 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            style={activeTab === tab.id ? accentBtnStyle : {}}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  {avatar ? (
                    <img src={getImageUrl(avatar)} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-slate-600" />
                  ) : (
                    <div
                      style={{ backgroundColor: `${accentColor}33`, borderColor: `${accentColor}4d` }}
                      className="w-20 h-20 rounded-full border-2 flex items-center justify-center"
                    >
                      <User className="w-8 h-8" style={accentStyle} />
                    </div>
                  )}
                  {avatar && (
                    <button
                      onClick={() => setAvatar('')}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
                <div>
                  <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarUpload} className="hidden" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => avatarRef.current?.click()}
                    disabled={avatarUploading}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    {avatarUploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    {avatar ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name</label>
                  <Input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <Input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email <Badge variant="outline" className="ml-1 text-xs border-slate-600 text-slate-500">read-only</Badge></label>
                  <Input value={profile.email} disabled className="bg-slate-900/30 border-slate-700 text-slate-500" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="+234 800 000 0000" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={profileLoading} style={accentBtnStyle} className="hover:opacity-90 text-slate-900 font-semibold">
                  {profileLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Platform Branding Tab ── */}
      {activeTab === 'branding' && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-base">Platform Branding</CardTitle>
            <p className="text-sm text-slate-400">Controls how the admin dashboard looks and what name/logo appears in the sidebar and platform pages.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div>
              <p className={sectionTitle} style={accentStyle}>Platform Logo</p>
              <div className="flex items-center gap-5">
                {branding.logo ? (
                  <div className="relative">
                    <img src={getImageUrl(branding.logo)} alt="logo" className="w-20 h-20 rounded-xl object-contain bg-slate-700 border border-slate-600 p-1.5" />
                    <button onClick={() => setBranding(b => ({ ...b, logo: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-700 border border-slate-600 border-dashed flex items-center justify-center">
                    <Palette className="w-7 h-7 text-slate-500" />
                  </div>
                )}
                <div>
                  <input type="file" accept="image/*" ref={logoRef} onChange={handleLogoUpload} className="hidden" />
                  <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()} disabled={logoUploading} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    {logoUploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    {branding.logo ? 'Replace Logo' : 'Upload Logo'}
                  </Button>
                  <p className="text-xs text-slate-500 mt-1">PNG, SVG, JPG. Recommended 256×256.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelCls}>Platform Name</label>
                <Input value={branding.platformName} onChange={e => setBranding(b => ({ ...b, platformName: e.target.value }))} className={inputCls} placeholder="RMS Platform" />
                <p className="text-xs text-slate-500 mt-1">Shown in the sidebar, platform page, and browser tabs.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Tagline / Subtitle</label>
                <Input value={branding.tagline} onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))} className={inputCls} placeholder="Powering Real Estate Excellence" />
              </div>
              <div>
                <label className={labelCls}>Primary Accent Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={branding.primaryColor || '#f59e0b'} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-slate-600 cursor-pointer bg-transparent p-0.5" />
                  <Input value={branding.primaryColor} onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} className={`${inputCls} w-32`} placeholder="#f59e0b" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Favicon URL</label>
                <Input value={branding.favicon} onChange={e => setBranding(b => ({ ...b, favicon: e.target.value }))} className={inputCls} placeholder="https://example.com/favicon.ico" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveBranding} disabled={brandingLoading} style={accentBtnStyle} className="hover:opacity-90 text-slate-900 font-semibold">
                {brandingLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Branding
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Platform CMS Tab ── */}
      {activeTab === 'cms' && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-base">Platform CMS</CardTitle>
            <p className="text-sm text-slate-400">Content shown on the public platform landing page (rms-admin-dashboard.vercel.app/platform).</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Hero */}
            <div>
              <p className={sectionTitle} style={accentStyle}>Hero Section</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Hero Title</label>
                  <Input value={cms.heroTitle} onChange={e => setCms(c => ({ ...c, heroTitle: e.target.value }))} className={inputCls} placeholder="Manage Your Real Estate Business Like a Pro" />
                </div>
                <div>
                  <label className={labelCls}>Hero Subtitle</label>
                  <Textarea rows={2} value={cms.heroSubtitle} onChange={e => setCms(c => ({ ...c, heroSubtitle: e.target.value }))} className={`${inputCls} resize-none`} placeholder="One platform for property management, HR, CRM, and more." />
                </div>
              </div>
            </div>

            {/* About */}
            <div>
              <p className={sectionTitle} style={accentStyle}>About / Description</p>
              <Textarea rows={4} value={cms.aboutText} onChange={e => setCms(c => ({ ...c, aboutText: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Brief description of the RMS platform..." />
            </div>

            {/* Contact */}
            <div>
              <p className={sectionTitle} style={accentStyle}>Contact & Support</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Contact Email</label>
                  <Input value={cms.contactEmail} onChange={e => setCms(c => ({ ...c, contactEmail: e.target.value }))} className={inputCls} placeholder="contact@rmsplatform.com" />
                </div>
                <div>
                  <label className={labelCls}>Support Email</label>
                  <Input value={cms.supportEmail} onChange={e => setCms(c => ({ ...c, supportEmail: e.target.value }))} className={inputCls} placeholder="support@rmsplatform.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <Input value={cms.contactPhone} onChange={e => setCms(c => ({ ...c, contactPhone: e.target.value }))} className={inputCls} placeholder="+234 800 000 0000" />
                </div>
                <div>
                  <label className={labelCls}>Office Address</label>
                  <Input value={cms.contactAddress} onChange={e => setCms(c => ({ ...c, contactAddress: e.target.value }))} className={inputCls} placeholder="123 Platform St, Lagos" />
                </div>
              </div>
            </div>

            {/* Social */}
            <div>
              <p className={sectionTitle} style={accentStyle}>Social Links</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Twitter / X</label>
                  <Input value={cms.twitterUrl} onChange={e => setCms(c => ({ ...c, twitterUrl: e.target.value }))} className={inputCls} placeholder="https://twitter.com/..." />
                </div>
                <div>
                  <label className={labelCls}>LinkedIn</label>
                  <Input value={cms.linkedinUrl} onChange={e => setCms(c => ({ ...c, linkedinUrl: e.target.value }))} className={inputCls} placeholder="https://linkedin.com/..." />
                </div>
                <div>
                  <label className={labelCls}>Instagram</label>
                  <Input value={cms.instagramUrl} onChange={e => setCms(c => ({ ...c, instagramUrl: e.target.value }))} className={inputCls} placeholder="https://instagram.com/..." />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveCms} disabled={cmsLoading} style={accentBtnStyle} className="hover:opacity-90 text-slate-900 font-semibold">
                {cmsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save CMS Content
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Security Tab ── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Lock className="w-4 h-4" style={accentStyle} /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'current' as const, label: 'Current Password', key: 'current' as const },
                { id: 'new' as const, label: 'New Password', key: 'newPass' as const },
                { id: 'confirm' as const, label: 'Confirm New Password', key: 'confirm' as const },
              ].map(f => (
                <div key={f.id}>
                  <label className={labelCls}>{f.label}</label>
                  <div className="relative">
                    <Input
                      type={showPass[f.id] ? 'text' : 'password'}
                      value={passwords[f.key]}
                      onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))}
                      className={`${inputCls} pr-10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => ({ ...s, [f.id]: !s[f.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPass[f.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      passwords.newPass.length === 0 ? 'w-0' :
                      passwords.newPass.length < 6 ? 'w-1/4 bg-red-500' :
                      passwords.newPass.length < 10 ? 'w-1/2 bg-amber-500' :
                      passwords.newPass.length < 14 ? 'w-3/4 bg-blue-500' :
                      'w-full bg-green-500'
                    }`}
                  />
                </div>
                <span className="text-xs text-slate-400 w-16 text-right">
                  {passwords.newPass.length === 0 ? '' :
                   passwords.newPass.length < 6 ? 'Weak' :
                   passwords.newPass.length < 10 ? 'Fair' :
                   passwords.newPass.length < 14 ? 'Good' : 'Strong'}
                </span>
              </div>
              {passwords.confirm && passwords.newPass !== passwords.confirm && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <X className="w-3 h-3" /> Passwords do not match
                </p>
              )}
              {passwords.confirm && passwords.newPass === passwords.confirm && passwords.newPass.length >= 8 && (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
              <div className="flex justify-end pt-1">
                <Button onClick={handleChangePassword} disabled={passwordLoading || !passwords.current || passwords.newPass !== passwords.confirm || passwords.newPass.length < 8} style={accentBtnStyle} className="hover:opacity-90 text-slate-900 font-semibold">
                  {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Security Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Role', value: 'Super Administrator', icon: Crown, color: accentColor },
                { label: 'Session', value: 'JWT authenticated', icon: Shield, color: '#4ade80' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    {item.label}
                  </div>
                  <span className="text-sm text-slate-200">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
