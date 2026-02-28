'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Home,
  DollarSign,
  Eye,
  Edit,
  UserX,
  UserCheck,
  Trash2,
  Download,
  RefreshCw,
  Loader2,
  KeyRound,
  Upload,
  FileSpreadsheet,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';

interface ClientData {
  id: string;
  userId: string;
  realtorId: string | null;
  totalPurchaseValue: number | string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    status: string;
    createdAt: string;
  };
  realtor?: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
  _count: {
    ownedProperties: number;
    purchases: number;
  };
}

interface ClientResponse {
  data: ClientData[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RealtorOption {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  realtorId: string;
  password: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [realtors, setRealtors] = useState<RealtorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  // Reset password
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<{ userId: string; name: string } | null>(null);
  const [resetMode, setResetMode] = useState<'generate' | 'custom'>('generate');
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdResult, setResetPwdResult] = useState<string | null>(null);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);

  // Bulk import
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    realtorId: '',
    password: '',
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', meta.page.toString());
      params.append('limit', '50');
      if (searchTerm) params.append('search', searchTerm);

      const response = await api.get<ClientResponse>(`/clients?${params.toString()}`);
      const data = response.data || response;
      setClients(Array.isArray(data) ? data : (data as any).data || []);
      if ((data as any).meta) {
        setMeta((data as any).meta);
      }
    } catch (error: any) {
      console.error('Failed to fetch clients:', error);
      toast.error(error.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [meta.page, searchTerm]);

  const fetchRealtors = useCallback(async () => {
    try {
      const response = await api.get<any>('/admin/realtors?limit=100');
      const data = response.data || response;
      setRealtors(Array.isArray(data) ? data : (data as any).data || []);
    } catch (error) {
      console.error('Failed to fetch realtors:', error);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchRealtors();
  }, [fetchClients, fetchRealtors]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesStatus = filterStatus === 'ALL' || client.user.status === filterStatus;
      return matchesStatus;
    });
  }, [clients, filterStatus]);

  const stats = useMemo(() => {
    const activeCount = clients.filter(c => c.user.status === 'ACTIVE').length;
    const totalProperties = clients.reduce((sum, c) => sum + (c._count?.ownedProperties || 0), 0);
    const totalPortfolio = clients.reduce((sum, c) => sum + Number(c.totalPurchaseValue || 0), 0);

    return [
      { title: 'Total Clients', value: meta.total.toString(), icon: Briefcase, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      { title: 'Active Clients', value: activeCount.toString(), icon: Briefcase, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'Total Properties', value: totalProperties.toString(), icon: Home, color: 'text-purple-600', bgColor: 'bg-purple-100' },
      { title: 'Portfolio Value', value: formatCurrency(totalPortfolio), icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10' },
    ];
  }, [clients, meta.total]);

  const handleAddClient = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading('add');
    try {
      await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: 'CLIENT',
        realtorId: formData.realtorId || undefined,
      });

      setAddDialogOpen(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', realtorId: '', password: '' });
      toast.success('Client added successfully!');
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add client');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditClient = async () => {
    if (!selectedClient) return;

    setActionLoading('edit');
    try {
      await api.patch(`/users/${selectedClient.userId}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      });

      if (formData.realtorId && formData.realtorId !== selectedClient.realtorId) {
        await api.patch(`/clients/${selectedClient.id}`, {
          realtorId: formData.realtorId,
        });
      }

      setEditDialogOpen(false);
      toast.success('Client updated successfully!');
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update client');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (client: ClientData) => {
    setActionLoading(client.id);
    try {
      const newStatus = client.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/users/${client.userId}/status`, { status: newStatus });
      toast.success(`Client ${client.user.status === 'ACTIVE' ? 'deactivated' : 'activated'} successfully!`);
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClient = async (client: ClientData) => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    setActionLoading(client.id);
    try {
      await api.delete(`/users/${client.userId}`);
      toast.success('Client deleted successfully!');
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete client');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditDialog = (client: ClientData) => {
    setSelectedClient(client);
    setFormData({
      firstName: client.user.firstName,
      lastName: client.user.lastName,
      email: client.user.email,
      phone: client.user.phone || '',
      realtorId: client.realtorId || '',
      password: '',
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = (client: ClientData) => {
    setSelectedClient(client);
    setViewDialogOpen(true);
  };

  const openResetPassword = (client: ClientData) => {
    setResetPwdTarget({ userId: client.userId, name: `${client.user.firstName} ${client.user.lastName}` });
    setResetMode('generate');
    setResetPwdValue('');
    setResetPwdResult(null);
    setResetPwdOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPwdTarget) return;
    if (resetMode === 'custom' && resetPwdValue.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setResetPwdLoading(true);
    try {
      const body: any = {};
      if (resetMode === 'custom') body.newPassword = resetPwdValue;
      const res = await api.patch<any>(`/admin/users/${resetPwdTarget.userId}/reset-password`, body);
      const data = res.data || res;
      setResetPwdResult(data.temporaryPassword || 'done');
      toast.success('Password reset successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setResetPwdLoading(false);
    }
  };

  const handleDownloadClientTemplate = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${base}/api/v1/clients/import-template`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'client-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleBulkImportClients = async () => {
    if (!importFile) { toast.error('Please select a file first'); return; }
    setImporting(true);
    setImportResults(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const form = new FormData();
      form.append('file', importFile);
      const res = await fetch(`${base}/api/v1/clients/bulk-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      const result = data.data || data;
      setImportResults(result);
      if (result.created > 0) { toast.success(`Import complete: ${result.created} created`); fetchClients(); }
      else { toast.info('Import complete: no new records created'); }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Properties', 'Portfolio Value', 'Assigned Realtor', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredClients.map(c => [
        `"${c.user.firstName} ${c.user.lastName}"`,
        c.user.email,
        c.user.phone || '',
        c._count?.ownedProperties || 0,
        c.totalPurchaseValue,
        c.realtor ? `"${c.realtor.user.firstName} ${c.realtor.user.lastName}"` : 'Unassigned',
        c.user.status,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Clients data exported successfully!');
  };

  const getRealtorName = (client: ClientData) => {
    if (client.realtor) {
      return `${client.realtor.user.firstName} ${client.realtor.user.lastName}`;
    }
    return 'Unassigned';
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

      {/* Clients List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              All Clients
            </CardTitle>
            <div className="flex flex-col md:flex-row flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  className="pl-9 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="w-full md:w-auto px-3 py-2 border rounded-md text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <Button variant="outline" size="sm" onClick={fetchClients} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setImportFile(null); setImportResults(null); setImportOpen(true); }}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-4 font-medium min-w-[180px]">Client</th>
                    <th className="pb-4 font-medium min-w-[200px]">Contact</th>
                    <th className="pb-4 font-medium min-w-[100px]">Properties</th>
                    <th className="pb-4 font-medium min-w-[140px]">Portfolio Value</th>
                    <th className="pb-4 font-medium min-w-[150px]">Assigned Realtor</th>
                    <th className="pb-4 font-medium min-w-[90px]">Status</th>
                    <th className="pb-4 font-medium min-w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            {client.user.avatar && <AvatarImage src={client.user.avatar} alt={`${client.user.firstName} ${client.user.lastName}`} />}
                            <AvatarFallback className="bg-primary text-white">
                              {client.user.firstName[0]}{client.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{client.user.firstName} {client.user.lastName}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {client.user.email}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.user.phone || 'N/A'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          <Home className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{client._count?.ownedProperties || 0}</span>
                        </div>
                      </td>
                      <td className="py-4 text-primary font-medium">{formatCurrency(Number(client.totalPurchaseValue || 0))}</td>
                      <td className="py-4">{getRealtorName(client)}</td>
                      <td className="py-4">
                        <Badge variant={client.user.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {client.user.status}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionLoading === client.id}>
                              {actionLoading === client.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openViewDialog(client)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(client)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPassword(client)}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStatus(client)}>
                              {client.user.status === 'ACTIVE' ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteClient(client)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No clients found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={(open) => { setResetPwdOpen(open); if (!open) setResetPwdResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {resetPwdTarget && (
              <p className="text-sm text-muted-foreground">Resetting password for <span className="font-medium text-foreground">{resetPwdTarget.name}</span></p>
            )}
            {!resetPwdResult ? (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setResetMode('generate')} className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${resetMode === 'generate' ? 'bg-primary text-white border-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-muted'}`}>Auto-generate</button>
                  <button type="button" onClick={() => setResetMode('custom')} className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${resetMode === 'custom' ? 'bg-primary text-white border-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-muted'}`}>Set custom</button>
                </div>
                {resetMode === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password *</Label>
                    <Input id="new-password" type="password" placeholder="Min. 8 characters" value={resetPwdValue} onChange={(e) => setResetPwdValue(e.target.value)} />
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                {resetPwdResult !== 'done' ? (
                  <>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Temporary password generated:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded border text-sm font-mono">{resetPwdResult}</code>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => { navigator.clipboard.writeText(resetPwdResult!); toast.success('Copied!'); }}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Password reset successfully.</p>
                )}
                <p className="text-xs text-muted-foreground">User will need to log in again.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwdOpen(false); setResetPwdResult(null); }}>{resetPwdResult ? 'Close' : 'Cancel'}</Button>
            {!resetPwdResult && (
              <Button onClick={handleResetPassword} disabled={resetPwdLoading}>
                {resetPwdLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportFile(null); setImportResults(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Import Clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">Download the template, fill in client data, then upload.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadClientTemplate}>
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>
            <div>
              <Label className="mb-2 block">Upload File (.xlsx, .xls, .csv)</Label>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary transition-colors bg-gray-50 dark:bg-gray-800">
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResults(null); }} />
                {importFile ? (
                  <div className="text-center px-4">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-1 text-green-600" />
                    <p className="text-sm font-medium truncate max-w-[200px]">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select or drag & drop</p>
                    <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
                  </div>
                )}
              </label>
            </div>
            {importResults && (
              <div className="space-y-2">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 font-medium">{importResults.created} created</span>
                  <span className="text-yellow-600 font-medium">{importResults.skipped} skipped</span>
                  <span className="text-red-600 font-medium">{importResults.errors?.length || 0} errors</span>
                </div>
                {importResults.errors?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border rounded-lg divide-y text-xs">
                    {importResults.errors.map((err: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 text-red-600">Row {err.row}: {err.email} — {err.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); setImportResults(null); }}>Close</Button>
            <Button onClick={handleBulkImportClients} disabled={!importFile || importing}>
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+234 xxx xxx xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="realtor">Assign Realtor</Label>
              <select
                id="realtor"
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={formData.realtorId}
                onChange={(e) => setFormData({ ...formData, realtorId: e.target.value })}
              >
                <option value="">Select a realtor</option>
                {realtors.map(realtor => (
                  <option key={realtor.id} value={realtor.id}>
                    {realtor.user.firstName} {realtor.user.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClient} disabled={actionLoading === 'add'}>
              {actionLoading === 'add' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-realtor">Assigned Realtor</Label>
              <select
                id="edit-realtor"
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={formData.realtorId}
                onChange={(e) => setFormData({ ...formData, realtorId: e.target.value })}
              >
                <option value="">Select a realtor</option>
                {realtors.map(realtor => (
                  <option key={realtor.id} value={realtor.id}>
                    {realtor.user.firstName} {realtor.user.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditClient} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Client Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Client Profile</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  {selectedClient.user.avatar && <AvatarImage src={selectedClient.user.avatar} />}
                  <AvatarFallback className="bg-primary text-white text-xl">
                    {selectedClient.user.firstName[0]}{selectedClient.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedClient.user.firstName} {selectedClient.user.lastName}</h3>
                  <Badge variant={selectedClient.user.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {selectedClient.user.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedClient.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedClient.user.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Properties Owned</p>
                  <p className="text-xl font-bold">{selectedClient._count?.ownedProperties || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Portfolio Value</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(Number(selectedClient.totalPurchaseValue || 0))}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-muted-foreground">Assigned Realtor</p>
                <p className="font-medium">{getRealtorName(selectedClient)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedClient) openEditDialog(selectedClient);
            }}>
              Edit Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
