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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getToken } from '@/lib/auth-storage';

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

const roleBadgeColor: Record<string, string> = {
  ADMIN: 'bg-blue-100 text-blue-700',
  GENERAL_OVERSEER: 'bg-purple-100 text-purple-700',
  HR: 'bg-teal-100 text-teal-700',
  REALTOR: 'bg-emerald-100 text-emerald-700',
  CLIENT: 'bg-orange-100 text-orange-700',
  STAFF: 'bg-gray-100 text-gray-700',
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
  const [detailTab, setDetailTab] = useState<'info' | 'users'>('info');
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
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
  const frontendDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const [editLogoUploading, setEditLogoUploading] = useState(false);
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

  const fetchTenantUsers = useCallback(async (companyId: string) => {
    setUsersLoading(true);
    try {
      const res = await api.get<any>(`/companies/${companyId}/users?limit=50`);
      setTenantUsers(res.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showDetail && detailTab === 'users') {
      fetchTenantUsers(showDetail.id);
    }
  }, [detailTab, showDetail, fetchTenantUsers]);

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

  const handleAssignRole = async (userId: string, newRole: string) => {
    if (!showDetail) return;
    setAssigningRole(userId);
    try {
      await api.patch(`/companies/${showDetail.id}/users/${userId}/role`, { role: newRole });
      toast.success('Role updated successfully');
      fetchTenantUsers(showDetail.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setAssigningRole(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage tenant companies and their databases</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Company
        </Button>
      </div>

      {/* Search + View toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchCompanies} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-slate-800 text-amber-400' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-2 transition-colors ${viewMode === 'grid' ? 'bg-slate-800 text-amber-400' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Companies List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No companies yet</h3>
            <p className="text-muted-foreground mb-4">Create your first company to start onboarding clients</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Company
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid gap-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
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

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex gap-4 text-muted-foreground">
                      <span>{company.stats?.users || 0} users</span>
                      <span>{company.stats?.properties || 0} properties</span>
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

                    <div className="flex gap-1">
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
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                {/* Logo + status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
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
                </div>
              </CardContent>
            </Card>
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
          <Card className="w-full max-w-lg max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <CardTitle>Add Company</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => { setShowCreate(false); setLogoPreview(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Mode tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-6">
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

            <CardContent className="overflow-y-auto flex-1 pt-4">
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
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
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
                      placeholder="RMS Platform"
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
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={existingDbData.primaryColor}
                          onChange={(e) => setExistingDbData({ ...existingDbData, primaryColor: e.target.value })}
                          className="w-10 h-10 rounded cursor-pointer border"
                        />
                        <Input
                          value={existingDbData.primaryColor}
                          onChange={(e) => setExistingDbData({ ...existingDbData, primaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* Company Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <CardTitle className="flex items-center gap-2">
                {showDetail.logo ? (
                  <img src={showDetail.logo} alt="" className="w-8 h-8 rounded object-contain" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
                {showDetail.name}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowDetail(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-6">
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
            </div>

            <CardContent className="overflow-y-auto flex-1 pt-4">
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
                          <div className="flex gap-2 mt-1">
                            <input
                              type="color"
                              value={editData.primaryColor}
                              onChange={(e) => setEditData((d) => ({ ...d, primaryColor: e.target.value }))}
                              className="w-10 h-10 rounded cursor-pointer border"
                            />
                            <Input
                              value={editData.primaryColor}
                              onChange={(e) => setEditData((d) => ({ ...d, primaryColor: e.target.value }))}
                            />
                          </div>
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

              {detailTab === 'users' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Assign roles to users in this tenant company</p>
                    <Button variant="outline" size="sm" onClick={() => fetchTenantUsers(showDetail.id)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                    </Button>
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
