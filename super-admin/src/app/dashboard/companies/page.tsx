'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Copy,
  Power,
  RotateCcw,
  Eye,
  X,
  Users,
  ShieldCheck,
  Upload,
  Link2,
  LayoutGrid,
  List,
  Pencil,
  Save,
  Download,
  Trash2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getToken } from '@/lib/auth-storage';
import { usePlatformBranding } from '@/hooks/use-platform-branding';

interface Company {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logo?: string;
  primaryColor?: string;
  inviteCode: string;
  isActive: boolean;
  plan: string;
  maxUsers: number;
  createdAt: string;
  pwaSettings?: Record<string, any>;
  stats?: { users: number; properties: number; sales: number };
}

interface TenantUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ASSIGNABLE_ROLES = ['ADMIN', 'GENERAL_OVERSEER', 'HR', 'REALTOR', 'CLIENT', 'STAFF'] as const;

const PRESET_THEMES = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
] as const;

const roleBadgeColor: Record<string, string> = {
  ADMIN: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  GENERAL_OVERSEER: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  HR: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  REALTOR: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  CLIENT: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  STAFF: 'bg-muted text-muted-foreground',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'new' | 'existing'>('new');
  const [showDetail, setShowDetail] = useState<Company | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'users' | 'pwa'>('info');
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tenantUserPage, setTenantUserPage] = useState(1);
  const [tenantUserMeta, setTenantUserMeta] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 0 });
  const [tenantUserSearch, setTenantUserSearch] = useState('');
  const [tenantUserRole, setTenantUserRole] = useState('');
  const [assigningRole, setAssigningRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const editLogoInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [reprovisioning, setReprovisioning] = useState(false);
  const [exportingCompany, setExportingCompany] = useState<string | null>(null);
  const [verifyingDNS, setVerifyingDNS] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<Company | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [migratingAll, setMigratingAll] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ companyId: string; userId: string; name: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [pwaData, setPwaData] = useState({ appName: '', shortName: '', description: '', themeColor: '#3b82f6', bgColor: '#ffffff', splashLogo: '', splashAnimation: 'none' });
  const [pwaSaving, setPwaSaving] = useState(false);
  const pwaLogoInputRef = useRef<HTMLInputElement>(null);
  const [pwaLogoUploading, setPwaLogoUploading] = useState(false);
  const [confirmResetData, setConfirmResetData] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const frontendDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const [editLogoUploading, setEditLogoUploading] = useState(false);
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#3b82f6';
  const [editData, setEditData] = useState({
    name: '',
    domain: '',
    logo: '',
    primaryColor: '#3b82f6',
    maxUsers: 50,
    plan: 'standard',
  });
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    logo: '',
    primaryColor: '#3b82f6',
    maxUsers: 50,
  });
  const [existingDbData, setExistingDbData] = useState({
    name: '',
    slug: '',
    domain: '',
    databaseUrl: '',
    logo: '',
    primaryColor: '#3b82f6',
    maxUsers: 50,
  });

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<any>(`/companies?${params}`);
      // API returns { data: [...], meta: {...} } directly
      setCompanies(res.data || []);
      setMeta(res.meta || {});
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Reset edit state whenever a different company is opened in the detail modal
  useEffect(() => {
    if (showDetail) {
      setEditMode(false);
      setDetailTab('info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetail?.id]);

  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleLogoUpload = async (file: File, setter: (url: string) => void) => {
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/upload/company-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const logoUrl = (data?.data || data)?.url || (data?.data || data)?.path || '';
      setter(logoUrl);
      setLogoPreview(logoUrl);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/companies', formData);
      toast.success('Company created! Schema is being provisioned.');
      setShowCreate(false);
      setFormData({ name: '', slug: '', domain: '', logo: '', primaryColor: '#3b82f6', maxUsers: 50 });
      setLogoPreview('');
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleRegisterExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/companies/register-existing', existingDbData);
      toast.success('Company registered successfully.');
      setShowCreate(false);
      setExistingDbData({ name: '', slug: '', domain: '', databaseUrl: '', logo: '', primaryColor: '#3b82f6', maxUsers: 50 });
      setLogoPreview('');
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to register company');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (company: Company) => {
    try {
      await api.patch(`/companies/${company.id}/toggle-active`, {});
      toast.success(`Company ${company.isActive ? 'deactivated' : 'activated'}`);
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle status');
    }
  };

  const handleRegenerateInvite = async (company: Company) => {
    try {
      const res = await api.post<any>(`/companies/${company.id}/regenerate-invite`, {});
      const result = res.data || res;
      toast.success(`New invite code: ${result.inviteCode}`);
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate invite code');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const viewDetail = async (company: Company) => {
    setDetailTab('info');
    setEditMode(false);
    setTenantUsers([]);
    try {
      const res = await api.get<any>(`/companies/${company.id}`);
      const detail = res.data || res;
      setShowDetail(detail);
      setEditData({
        name: detail.name || '',
        domain: detail.domain || '',
        logo: detail.logo || '',
        primaryColor: detail.primaryColor || '#3b82f6',
        maxUsers: detail.maxUsers || 50,
        plan: detail.plan || 'standard',
      });
      setPwaData({
        appName: detail.pwaSettings?.appName || detail.name || '',
        shortName: detail.pwaSettings?.shortName || '',
        description: detail.pwaSettings?.description || '',
        themeColor: detail.pwaSettings?.themeColor || detail.primaryColor || '#3b82f6',
        bgColor: detail.pwaSettings?.bgColor || '#ffffff',
        splashLogo: detail.pwaSettings?.splashLogo || '',
        splashAnimation: detail.pwaSettings?.splashAnimation || 'none',
      });
    } catch {
      setShowDetail(company);
      setEditData({
        name: company.name || '',
        domain: company.domain || '',
        logo: company.logo || '',
        primaryColor: company.primaryColor || '#3b82f6',
        maxUsers: company.maxUsers || 50,
        plan: company.plan || 'standard',
      });
    }
  };

  const handleReprovision = async () => {
    if (!showDetail) return;
    setReprovisioning(true);
    const toastId = toast.loading('Applying schema migrations… this may take a few seconds');
    try {
      await api.post(`/companies/${showDetail.id}/reprovision`, {});
      toast.success('Tenant schema migrated successfully', { id: toastId });
    } catch (error: any) {
      const msg: string = error.message || 'Migration failed';
      // 504 means the operation ran past the serverless timeout but may still complete
      if (msg.includes('504') || msg.includes('Gateway') || msg.includes('timed out')) {
        toast.warning('Migration is still running in the background. Wait 30 s then refresh.', { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setReprovisioning(false);
    }
  };

  const handleResetData = async () => {
    if (!showDetail) return;
    setResettingData(true);
    const toastId = toast.loading('Wiping tenant data… this may take a few seconds');
    try {
      await api.post(`/companies/${showDetail.id}/reset-data`, {});
      toast.success('All tenant data wiped. Company starts on a clean slate.', { id: toastId });
      setConfirmResetData(false);
    } catch (error: any) {
      toast.error(error.message || 'Reset failed', { id: toastId });
    } finally {
      setResettingData(false);
    }
  };

  const handleUpdateCompany = async () => {
    if (!showDetail) return;
    setEditSaving(true);
    try {
      const res = await api.put<any>(`/companies/${showDetail.id}`, editData);
      const updated = res.data || res;
      setShowDetail({ ...showDetail, ...updated });
      setEditMode(false);
      toast.success('Company updated successfully');
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update company');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditLogoUpload = async (file: File) => {
    setEditLogoUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/upload/company-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const logoUrl = (data?.data || data)?.url || (data?.data || data)?.path;
      setEditData((d) => ({ ...d, logo: logoUrl }));
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setEditLogoUploading(false);
    }
  };

  const fetchTenantUsers = useCallback(async (companyId: string, page = 1, search = '', role = '') => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) });
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      const res = await api.get<any>(`/companies/${companyId}/users?${params}`);
      setTenantUsers(res.data || []);
      setTenantUserMeta({ total: res.meta?.total || 0, totalPages: res.meta?.totalPages || 0 });
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showDetail && detailTab === 'users') {
      fetchTenantUsers(showDetail.id, tenantUserPage, tenantUserSearch, tenantUserRole);
    }
  }, [detailTab, showDetail, fetchTenantUsers, tenantUserPage, tenantUserSearch, tenantUserRole]);

  // Reset filters/page when switching to a different company
  useEffect(() => {
    setTenantUserPage(1);
    setTenantUserSearch('');
    setTenantUserRole('');
  }, [showDetail?.id]);

  const handleExportTenant = async (company: Company) => {
    setExportingCompany(company.id);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${base}/api/v1/companies/${company.id}/export`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${company.slug}-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    } finally {
      setExportingCompany(null);
    }
  };

  const handleVerifyDNS = async () => {
    if (!showDetail) return;
    setVerifyingDNS(true);
    try {
      const res = await api.get<any>(`/companies/resolve?domain=${encodeURIComponent(showDetail.domain)}`);
      const co = res?.data || res;
      if (co?.id === showDetail.id) {
        toast.success('Domain resolves correctly — DNS is configured');
      } else {
        toast.warning('Domain is not yet pointing to this platform');
      }
    } catch {
      toast.error('Could not verify domain');
    } finally {
      setVerifyingDNS(false);
    }
  };

  const handleMigrateAll = async () => {
    setMigratingAll(true);
    const toastId = toast.loading('Applying schema to all active tenants…');
    try {
      const res = await api.post<any>('/companies/migrate-all', {});
      const result = res?.data || res;
      const { migrated = 0, failed = 0 } = result || {};
      if (failed === 0) {
        toast.success(`All ${migrated} tenants migrated successfully`, { id: toastId });
      } else {
        toast.warning(`${migrated} migrated, ${failed} failed — check server logs`, { id: toastId });
      }
    } catch (error: any) {
      const msg: string = error.message || 'Migration failed';
      if (msg.includes('504') || msg.includes('Gateway') || msg.includes('timed out')) {
        toast.warning('Migration is running in the background. Wait 30s then refresh.', { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setMigratingAll(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteCompany = async (company: Company) => {
    setConfirmDeleteCompany(null);
    setDeleteConfirmText('');
    setDeletingId(company.id);
    try {
      await api.delete(`/companies/${company.id}`);
      toast.success(`"${company.name}" deleted permanently`);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(company.id); return n; });
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete company');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setBulkDeleting(true);
    try {
      const res = await api.post<any>('/companies/bulk-purge', { ids: Array.from(selectedIds) });
      const result = res?.data || res;
      toast.success(result?.message || `${selectedIds.size} companies deleted`);
      setSelectedIds(new Set());
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete companies');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleAssignRole = async (userId: string, newRole: string) => {
    if (!showDetail) return;
    setAssigningRole(userId);
    try {
      await api.patch(`/companies/${showDetail.id}/users/${userId}/role`, { role: newRole });
      toast.success('Role updated successfully');
      fetchTenantUsers(showDetail.id, tenantUserPage, tenantUserSearch, tenantUserRole);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setAssigningRole(null);
    }
  };

  const handleDeleteUser = async (companyId: string, userId: string) => {
    setDeletingUser(userId);
    try {
      await api.delete(`/companies/${companyId}/users/${userId}`);
      toast.success('User deleted');
      setConfirmDeleteUser(null);
      fetchTenantUsers(companyId, tenantUserPage, tenantUserSearch, tenantUserRole);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeletingUser(null);
    }
  };

  const handleSavePwa = async () => {
    if (!showDetail) return;
    setPwaSaving(true);
    try {
      await api.put(`/companies/${showDetail.id}/pwa`, pwaData);
      toast.success('PWA settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save PWA settings');
    } finally {
      setPwaSaving(false);
    }
  };

  const handlePwaLogoUpload = async (file: File) => {
    setPwaLogoUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/upload/company-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const url = (data?.data || data)?.url || (data?.data || data)?.path || '';
      setPwaData((d) => ({ ...d, splashLogo: url }));
      toast.success('Splash logo uploaded');
    } catch {
      toast.error('Failed to upload splash logo');
    } finally {
      setPwaLogoUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage tenant companies and their databases</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium shadow-md hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <Plus className="w-4 h-4" />
          Create Company
        </button>
      </div>

      {/* Search + View toggle */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-3 text-sm neuo-inset outline-none text-foreground placeholder:text-muted-foreground rounded-xl"
          />
        </div>
        <button onClick={fetchCompanies} title="Refresh" className="neuo-btn w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={handleMigrateAll}
          disabled={migratingAll}
          title="Apply latest schema DDL to all active tenant databases"
          className="neuo-btn flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium text-muted-foreground disabled:opacity-50"
        >
          {migratingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Migrate All
        </button>
        {companies.length > 0 && (
          <button
            onClick={() => setSelectedIds(selectedIds.size === companies.length ? new Set() : new Set(companies.map((c) => c.id)))}
            title="Select / deselect all visible companies"
            className="neuo-btn flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium text-muted-foreground"
          >
            <CheckSquare className="w-4 h-4" />
            {selectedIds.size === companies.length && companies.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
        )}
        <div className="flex neuo-inset rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className="px-3 py-2 transition-colors"
            style={viewMode === 'list' ? { color: accent } : { color: '#9ca3af' }}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className="px-3 py-2 transition-colors"
            style={viewMode === 'grid' ? { color: accent } : { color: '#9ca3af' }}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="text-sm font-medium text-red-700 dark:text-red-400 flex-1">
            {selectedIds.size} {selectedIds.size === 1 ? 'company' : 'companies'} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkDeleting}
          >
            {bulkDeleting
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
            Delete Selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Companies List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
        </div>
      ) : companies.length === 0 ? (
        <div className="neuo-card p-12 flex flex-col items-center justify-center text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No companies yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Create your first company to start onboarding clients</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium shadow-md"
            style={{ backgroundColor: accent }}
          >
            <Plus className="w-4 h-4" /> Create Company
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="grid gap-3">
          {companies.map((company) => (
            <div key={company.id} className={`neuo-card p-4 transition-all ${selectedIds.has(company.id) ? 'ring-2 ring-red-400' : ''}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(company.id)}
                      onChange={() => toggleSelectId(company.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-red-500 cursor-pointer shrink-0"
                    />
                    {company.logo ? (
                      <img src={company.logo} alt="" className="w-10 h-10 rounded-lg object-contain" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: (company.primaryColor || '#3b82f6') + '20' }}
                      >
                        <Building2 className="w-5 h-5" style={{ color: company.primaryColor || '#3b82f6' }} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{company.name}</h3>
                      <p className="text-sm text-muted-foreground">{company.domain}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex gap-3 text-muted-foreground">
                      <span>{company.stats?.users || 0} users</span>
                      <span>{company.stats?.properties || 0} props</span>
                      <span>{company.stats?.sales || 0} sales</span>
                    </div>

                    <Badge variant={company.isActive ? 'default' : 'secondary'}>
                      {company.isActive ? 'Active' : 'Inactive'}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{company.inviteCode}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(company.inviteCode)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetail(company)} title="View / Edit">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(company)} title={company.isActive ? 'Deactivate' : 'Activate'}>
                        <Power className={`w-4 h-4 ${company.isActive ? 'text-green-600' : 'text-red-500'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRegenerateInvite(company)} title="Regenerate invite code">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportTenant(company)} title="Export tenant data" disabled={exportingCompany === company.id}>
                        {exportingCompany === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setConfirmDeleteCompany(company); setDeleteConfirmText(''); }} title="Delete company" disabled={deletingId === company.id}>
                        {deletingId === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          ))}
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div key={company.id} className={`neuo-card p-5 transition-all ${selectedIds.has(company.id) ? 'ring-2 ring-red-400' : ''}`}>
                {/* Logo + status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(company.id)}
                      onChange={() => toggleSelectId(company.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-red-500 cursor-pointer shrink-0 mt-1"
                    />
                    {company.logo ? (
                      <img src={company.logo} alt="" className="w-12 h-12 rounded-xl object-contain border" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: (company.primaryColor || '#3b82f6') + '20' }}
                      >
                        <Building2 className="w-6 h-6" style={{ color: company.primaryColor || '#3b82f6' }} />
                      </div>
                    )}
                  </div>
                  <Badge variant={company.isActive ? 'default' : 'secondary'} className="shrink-0">
                    {company.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <h3 className="font-semibold truncate mb-0.5">{company.name}</h3>
                <p className="text-xs text-muted-foreground truncate mb-3">{company.domain}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Users', value: company.stats?.users || 0 },
                    { label: 'Props', value: company.stats?.properties || 0 },
                    { label: 'Sales', value: company.stats?.sales || 0 },
                  ].map((s) => (
                    <div key={s.label} className="text-center bg-muted/50 rounded-lg py-1.5">
                      <p className="font-semibold text-sm">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Invite code */}
                <div className="flex items-center gap-1.5 mb-3">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{company.inviteCode}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(company.inviteCode)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => viewDetail(company)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(company)} title={company.isActive ? 'Deactivate' : 'Activate'}>
                    <Power className={`w-4 h-4 ${company.isActive ? 'text-green-600' : 'text-red-500'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRegenerateInvite(company)} title="Regenerate invite code">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportTenant(company)} title="Export tenant data" disabled={exportingCompany === company.id}>
                    {exportingCompany === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setConfirmDeleteCompany(company); setDeleteConfirmText(''); }} title="Delete company" disabled={deletingId === company.id}>
                    {deletingId === company.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create / Register Company Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">Add Company</h2>
              <button onClick={() => { setShowCreate(false); setLogoPreview(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-border shrink-0 px-6">
              <button
                onClick={() => setCreateMode('new')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${createMode === 'new' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Plus className="w-4 h-4" /> New Company
              </button>
              <button
                onClick={() => setCreateMode('existing')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${createMode === 'existing' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Link2 className="w-4 h-4" /> Register Existing DB
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {/* ── Logo upload shared component ── */}
              {(() => {
                const currentLogo = createMode === 'new' ? formData.logo : existingDbData.logo;
                const setLogo = (url: string) => createMode === 'new'
                  ? setFormData((f) => ({ ...f, logo: url }))
                  : setExistingDbData((f) => ({ ...f, logo: url }));
                return (
                  <div className="mb-4">
                    <label className="text-sm font-medium block mb-1.5">Company Logo</label>
                    <div className="flex items-center gap-3">
                      {/* Preview */}
                      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-gray-800">
                        {currentLogo || logoPreview ? (
                          <img src={currentLogo || logoPreview} alt="logo" className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, setLogo);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={logoUploading}
                          onClick={() => logoInputRef.current?.click()}
                          className="w-full"
                        >
                          {logoUploading ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...</>
                          ) : (
                            <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Logo</>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — max 5 MB</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── NEW COMPANY form ── */}
              {createMode === 'new' && (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Company Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData({ ...formData, name, slug: autoSlug(name) });
                      }}
                      placeholder="Acme Realty"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Slug *</label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="acme-realty"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">URL-safe identifier (lowercase, hyphens only)</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Domain *</label>
                    <Input
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="acme-realty.com"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Primary Color</label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {PRESET_THEMES.map((t) => (
                          <button
                            key={t.hex}
                            type="button"
                            title={t.name}
                            onClick={() => setFormData({ ...formData, primaryColor: t.hex })}
                            className="w-7 h-7 rounded-full border-2 transition-all"
                            style={{ backgroundColor: t.hex, borderColor: formData.primaryColor === t.hex ? '#111' : 'transparent' }}
                          />
                        ))}
                        <label title="Custom color" className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 cursor-pointer overflow-hidden flex items-center justify-center">
                          <input
                            type="color"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="opacity-0 absolute w-0 h-0"
                          />
                          <span className="text-gray-400 text-xs select-none">+</span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formData.primaryColor}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Users</label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.maxUsers}
                        onChange={(e) => setFormData({ ...formData, maxUsers: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setLogoPreview(''); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating || logoUploading}>
                      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create & Provision
                    </Button>
                  </div>
                </form>
              )}

              {/* ── REGISTER EXISTING DB form ── */}
              {createMode === 'existing' && (
                <form onSubmit={handleRegisterExisting} className="space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Use this to register an existing PostgreSQL database (e.g. your current RMS installation) as a tenant — no schema provisioning is performed.
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company Name *</label>
                    <Input
                      value={existingDbData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setExistingDbData({ ...existingDbData, name, slug: autoSlug(name) });
                      }}
                      placeholder="Vicson Digital Hub"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Slug *</label>
                    <Input
                      value={existingDbData.slug}
                      onChange={(e) => setExistingDbData({ ...existingDbData, slug: e.target.value })}
                      placeholder="rms-platform"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Domain *</label>
                    <Input
                      value={existingDbData.domain}
                      onChange={(e) => setExistingDbData({ ...existingDbData, domain: e.target.value })}
                      placeholder="rms.vercel.app"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Database URL *</label>
                    <Input
                      type="password"
                      value={existingDbData.databaseUrl}
                      onChange={(e) => setExistingDbData({ ...existingDbData, databaseUrl: e.target.value })}
                      placeholder="postgresql://user:pass@host/db"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">Connection string for the existing tenant database</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Primary Color</label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {PRESET_THEMES.map((t) => (
                          <button
                            key={t.hex}
                            type="button"
                            title={t.name}
                            onClick={() => setExistingDbData({ ...existingDbData, primaryColor: t.hex })}
                            className="w-7 h-7 rounded-full border-2 transition-all"
                            style={{ backgroundColor: t.hex, borderColor: existingDbData.primaryColor === t.hex ? '#111' : 'transparent' }}
                          />
                        ))}
                        <label title="Custom color" className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 cursor-pointer overflow-hidden flex items-center justify-center">
                          <input
                            type="color"
                            value={existingDbData.primaryColor}
                            onChange={(e) => setExistingDbData({ ...existingDbData, primaryColor: e.target.value })}
                            className="opacity-0 absolute w-0 h-0"
                          />
                          <span className="text-gray-400 text-xs select-none">+</span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{existingDbData.primaryColor}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Users</label>
                      <Input
                        type="number"
                        min={1}
                        value={existingDbData.maxUsers}
                        onChange={(e) => setExistingDbData({ ...existingDbData, maxUsers: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setLogoPreview(''); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creating || logoUploading}>
                      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Register Company
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual delete confirmation */}
      {confirmDeleteCompany && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Delete &quot;{confirmDeleteCompany.name}&quot;?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will permanently delete all users, properties, and uploaded files for this company.
                    This action <strong>cannot be undone</strong>.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Type <strong>{confirmDeleteCompany.name}</strong> to confirm</label>
                <Input
                  className="mt-1.5"
                  placeholder={confirmDeleteCompany.name}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setConfirmDeleteCompany(null); setDeleteConfirmText(''); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteCompany(confirmDeleteCompany)}
                  disabled={!!deletingId || deleteConfirmText !== confirmDeleteCompany.name}
                >
                  {deletingId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete Permanently
                </Button>
              </div>
          </div>
        </div>
      )}

      {/* Reset tenant data confirmation */}
      {confirmResetData && showDetail && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Reset &quot;{showDetail.name}&quot; to clean slate?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete all <strong>users, properties, sales, and uploaded files</strong> for this company.
                  The company account itself will remain active. This action <strong>cannot be undone</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmResetData(false)}>Cancel</Button>
              <Button
                onClick={handleResetData}
                disabled={resettingData}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {resettingData && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset All Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Delete {selectedIds.size} {selectedIds.size === 1 ? 'company' : 'companies'}?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will permanently delete <strong>{selectedIds.size}</strong> selected {selectedIds.size === 1 ? 'company' : 'companies'} along with all their users, properties, and uploaded files.
                    This action <strong>cannot be undone</strong>.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete {selectedIds.size} {selectedIds.size === 1 ? 'Company' : 'Companies'}
                </Button>
              </div>
          </div>
        </div>
      )}

      {/* User delete confirmation */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Delete &quot;{confirmDeleteUser.name}&quot;?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently remove the user from this tenant&apos;s database. This action <strong>cannot be undone</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteUser(confirmDeleteUser.companyId, confirmDeleteUser.userId)}
                disabled={!!deletingUser}
              >
                {deletingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Company Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                {showDetail.logo ? (
                  <img src={showDetail.logo} alt="" className="w-8 h-8 rounded object-contain" />
                ) : (
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="font-semibold text-foreground">{showDetail.name}</span>
              </div>
              <button onClick={() => setShowDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0 px-6">
              <button
                onClick={() => setDetailTab('info')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'info'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-4 h-4" /> Info
              </button>
              <button
                onClick={() => setDetailTab('users')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'users'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-4 h-4" /> Users & Roles
              </button>
              <button
                onClick={() => setDetailTab('pwa')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === 'pwa'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> PWA
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {detailTab === 'info' && (
                <div className="space-y-4">
                  {/* Edit / View toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(showDetail.createdAt).toLocaleDateString()}
                    </p>
                    {!editMode ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleReprovision}
                          disabled={reprovisioning}
                          title="Apply latest schema migrations to this tenant DB"
                        >
                          {reprovisioning
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Migrating…</>
                            : 'Migrate DB'
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleVerifyDNS}
                          disabled={verifyingDNS}
                          title="Check if the domain is pointing to this platform"
                        >
                          {verifyingDNS && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                          Verify DNS
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmResetData(true)}
                          disabled={resettingData}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50"
                          title="Wipe all tenant data and start on a clean slate (keeps company account)"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Reset Data
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditMode(false)} disabled={editSaving}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleUpdateCompany} disabled={editSaving || editLogoUploading}>
                          {editSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>

                  {editMode ? (
                    /* ── EDIT FORM ── */
                    <div className="space-y-4">
                      {/* Logo upload */}
                      <div>
                        <label className="text-sm font-medium block mb-1.5">Logo</label>
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-gray-800">
                            {editData.logo ? (
                              <img src={editData.logo} alt="logo" className="w-full h-full object-contain" />
                            ) : (
                              <Building2 className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              ref={editLogoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleEditLogoUpload(file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={editLogoUploading}
                              onClick={() => editLogoInputRef.current?.click()}
                              className="w-full"
                            >
                              {editLogoUploading ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...</>
                              ) : (
                                <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Logo</>
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — max 5 MB</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Company Name</label>
                        <Input value={editData.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Domain</label>
                        <Input value={editData.domain} onChange={(e) => setEditData((d) => ({ ...d, domain: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Primary Color</label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {PRESET_THEMES.map((t) => (
                              <button
                                key={t.hex}
                                type="button"
                                title={t.name}
                                onClick={() => setEditData((d) => ({ ...d, primaryColor: t.hex }))}
                                className="w-7 h-7 rounded-full border-2 transition-all"
                                style={{ backgroundColor: t.hex, borderColor: editData.primaryColor === t.hex ? '#111' : 'transparent' }}
                              />
                            ))}
                            <label title="Custom color" className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 cursor-pointer overflow-hidden flex items-center justify-center">
                              <input
                                type="color"
                                value={editData.primaryColor}
                                onChange={(e) => setEditData((d) => ({ ...d, primaryColor: e.target.value }))}
                                className="opacity-0 absolute w-0 h-0"
                              />
                              <span className="text-gray-400 text-xs select-none">+</span>
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{editData.primaryColor}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Max Users</label>
                          <Input
                            type="number"
                            min={1}
                            value={editData.maxUsers}
                            onChange={(e) => setEditData((d) => ({ ...d, maxUsers: Number(e.target.value) }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Plan</label>
                        <select
                          value={editData.plan}
                          onChange={(e) => setEditData((d) => ({ ...d, plan: e.target.value }))}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-background text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="standard">Standard</option>
                          <option value="professional">Professional</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    /* ── READ-ONLY VIEW ── */
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Slug</p>
                          <p className="font-medium">{showDetail.slug}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Domain</p>
                          <p className="font-medium">{showDetail.domain}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <Badge variant={showDetail.isActive ? 'default' : 'secondary'}>
                            {showDetail.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Plan</p>
                          <p className="font-medium capitalize">{showDetail.plan}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max Users</p>
                          <p className="font-medium">{showDetail.maxUsers}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Primary Color</p>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded border" style={{ backgroundColor: showDetail.primaryColor }} />
                            <span className="font-medium">{showDetail.primaryColor}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Invite Code</p>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-3 py-2 rounded text-sm flex-1">{showDetail.inviteCode}</code>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(showDetail.inviteCode)}>
                            <Copy className="w-4 h-4 mr-1" /> Copy
                          </Button>
                        </div>
                      </div>

                      {/* DNS Configuration */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">DNS Configuration</p>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Ask the client to add a DNS record so{' '}
                            <code className="font-mono">{showDetail.domain}</code> points to this platform.
                          </p>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">Type</p>
                              <p className="font-mono font-semibold">CNAME</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Host / Name</p>
                              <p className="font-mono font-semibold">@ (root)</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Points to</p>
                              <div className="flex items-center gap-1">
                                <p className="font-mono font-semibold truncate">{frontendDomain}</p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
                                  onClick={() => copyToClipboard(frontendDomain)}
                                  title="Copy"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            After DNS is set, the platform operator must also add{' '}
                            <strong>{showDetail.domain}</strong> to the frontend Vercel project
                            (Settings → Domains).
                          </p>
                        </div>
                      </div>

                      {(showDetail as any).stats && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Statistics</p>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Users', value: (showDetail as any).stats.users, isCurrency: false },
                              { label: 'Realtors', value: (showDetail as any).stats.realtors, isCurrency: false },
                              { label: 'Clients', value: (showDetail as any).stats.clients, isCurrency: false },
                              { label: 'Properties', value: (showDetail as any).stats.properties, isCurrency: false },
                              { label: 'Sales', value: (showDetail as any).stats.sales, isCurrency: false },
                              { label: 'Revenue', value: (showDetail as any).stats.revenue, isCurrency: true },
                            ].map((s) => (
                              <div key={s.label} className="bg-muted rounded-lg p-3 text-center">
                                <p className={`font-bold ${s.isCurrency ? 'text-sm' : 'text-lg'}`}>
                                  {s.isCurrency
                                    ? formatCurrency(Number(s.value) || 0)
                                    : (Number(s.value) || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {detailTab === 'pwa' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure the Progressive Web App (PWA) manifest for this tenant.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">App Name</label>
                      <Input className="mt-1" value={pwaData.appName} onChange={(e) => setPwaData((d) => ({ ...d, appName: e.target.value }))} placeholder="Acme Realty" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Short Name <span className="text-muted-foreground">(max 12)</span></label>
                      <Input className="mt-1" maxLength={12} value={pwaData.shortName} onChange={(e) => setPwaData((d) => ({ ...d, shortName: e.target.value }))} placeholder="Acme" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      rows={2}
                      value={pwaData.description}
                      onChange={(e) => setPwaData((d) => ({ ...d, description: e.target.value }))}
                      placeholder="A real estate management system for Acme Realty"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Theme Color</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="color" value={pwaData.themeColor} onChange={(e) => setPwaData((d) => ({ ...d, themeColor: e.target.value }))} className="w-9 h-9 rounded cursor-pointer border" />
                        <Input value={pwaData.themeColor} onChange={(e) => setPwaData((d) => ({ ...d, themeColor: e.target.value }))} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Background Color</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="color" value={pwaData.bgColor} onChange={(e) => setPwaData((d) => ({ ...d, bgColor: e.target.value }))} className="w-9 h-9 rounded cursor-pointer border" />
                        <Input value={pwaData.bgColor} onChange={(e) => setPwaData((d) => ({ ...d, bgColor: e.target.value }))} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Splash Logo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 bg-gray-50 dark:bg-gray-800">
                        {pwaData.splashLogo ? (
                          <img src={pwaData.splashLogo} alt="splash" className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input ref={pwaLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePwaLogoUpload(f); }} />
                        <Button type="button" variant="outline" size="sm" disabled={pwaLogoUploading} onClick={() => pwaLogoInputRef.current?.click()} className="w-full">
                          {pwaLogoUploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Splash Logo</>}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — 512×512 recommended</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Splash Animation</label>
                    <select
                      value={pwaData.splashAnimation}
                      onChange={(e) => setPwaData((d) => ({ ...d, splashAnimation: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="zoom">Zoom</option>
                      <option value="bounce">Bounce</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSavePwa} disabled={pwaSaving}>
                      {pwaSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save PWA Settings
                    </Button>
                  </div>
                </div>
              )}

              {detailTab === 'users' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      {tenantUserMeta.total > 0 ? `${tenantUserMeta.total} users` : 'Assign roles to users in this tenant company'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => fetchTenantUsers(showDetail.id, tenantUserPage, tenantUserSearch, tenantUserRole)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                    </Button>
                  </div>

                  {/* Search + Role Filter */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={tenantUserSearch}
                        onChange={(e) => { setTenantUserSearch(e.target.value); setTenantUserPage(1); }}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <select
                      value={tenantUserRole}
                      onChange={(e) => { setTenantUserRole(e.target.value); setTenantUserPage(1); }}
                      className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">All Roles</option>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : tenantUsers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No users found in this company</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tenantUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-muted/40 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{user.firstName} {user.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColor[user.role] || 'bg-gray-100 text-gray-600'}`}>
                              {user.role.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                              <select
                                disabled={assigningRole === user.id}
                                defaultValue={user.role}
                                onChange={(e) => handleAssignRole(user.id, e.target.value)}
                                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                ))}
                              </select>
                              {assigningRole === user.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete user"
                              disabled={deletingUser === user.id}
                              onClick={() => setConfirmDeleteUser({ companyId: showDetail.id, userId: user.id, name: `${user.firstName} ${user.lastName}` })}
                            >
                              {deletingUser === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {tenantUserMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground">
                        Page {tenantUserPage} of {tenantUserMeta.totalPages}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={tenantUserPage <= 1 || usersLoading}
                          onClick={() => setTenantUserPage((p) => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={tenantUserPage >= tenantUserMeta.totalPages || usersLoading}
                          onClick={() => setTenantUserPage((p) => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
