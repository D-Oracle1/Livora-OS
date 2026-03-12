'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserCog,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Download,
  RefreshCw,
  Loader2,
  Eye,
  Edit,
  UserX,
  UserCheck,
  Trash2,
  KeyRound,
  Upload,
  FileSpreadsheet,
  Copy,
  DollarSign,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import { Switch } from '@/components/ui/switch';

interface StaffData {
  id: string;
  userId: string;
  employeeId: string;
  position: string;
  title: string;
  employmentType: string;
  hireDate: string;
  isActive: boolean;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  baseSalary?: number | string | null;
  isTaxable?: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    status: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  manager?: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
  _count?: {
    directReports: number;
    tasksAssigned: number;
  };
}

interface StaffResponse {
  data: StaffData[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface DepartmentData {
  id: string;
  name: string;
  code: string;
}

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  employeeId: string;
  position: string;
  title: string;
  employmentType: string;
  departmentId: string;
  hireDate: string;
  baseSalary: string;
  isTaxable: boolean;
}

const getPositionBadge = (position: string) => {
  const colors: Record<string, string> = {
    EXECUTIVE: 'bg-red-100 text-red-700',
    DIRECTOR: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    TEAM_LEAD: 'bg-cyan-100 text-cyan-700',
    SENIOR: 'bg-green-100 text-green-700',
    JUNIOR: 'bg-yellow-100 text-yellow-700',
    INTERN: 'bg-gray-100 text-gray-700',
  };
  return (
    <Badge className={colors[position] || 'bg-gray-100 text-gray-700'}>
      {position.replace('_', ' ')}
    </Badge>
  );
};

const getStatusBadge = (status: string, isActive: boolean) => {
  if (!isActive) {
    return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
  }
  switch (status) {
    case 'ACTIVE':
      return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    case 'INACTIVE':
      return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function AdminStaffPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <AdminStaffPage />
    </Suspense>
  );
}

function AdminStaffPage() {
  const searchParams = useSearchParams();
  const [staff, setStaff] = useState<StaffData[]>([]);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || 'all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffData | null>(null);

  // Reset password
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<{ userId: string; name: string } | null>(null);
  const [resetMode, setResetMode] = useState<'generate' | 'custom'>('generate');
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdResult, setResetPwdResult] = useState<string | null>(null);

  // Bulk import
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any | null>(null);

  // Salary update dialog
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryTarget, setSalaryTarget] = useState<StaffData | null>(null);
  const [newSalary, setNewSalary] = useState('');

  const [formData, setFormData] = useState<StaffFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    employeeId: '',
    position: 'JUNIOR',
    title: '',
    employmentType: 'FULL_TIME',
    departmentId: '',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    isTaxable: true,
  });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', meta.page.toString());
      params.append('limit', '50');
      if (searchQuery) params.append('search', searchQuery);
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (positionFilter !== 'all') params.append('position', positionFilter.toUpperCase());
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active' ? 'true' : 'false');

      const response = await api.get<any>(`/staff?${params.toString()}`);
      // Backend wraps response as { success, data: [...], meta: {...}, timestamp }
      let staffList: StaffData[] = [];
      let responseMeta = null;

      if (Array.isArray(response)) {
        staffList = response;
      } else if (response?.data && Array.isArray(response.data)) {
        staffList = response.data;
        responseMeta = response.meta;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        staffList = response.data.data;
        responseMeta = response.data.meta || response.meta;
      }

      setStaff(staffList);
      if (responseMeta) {
        setMeta(responseMeta);
      }
    } catch (error: any) {
      console.error('Failed to fetch staff:', error);
      toast.error(error.message || 'Failed to load staff members');
    } finally {
      setLoading(false);
    }
  }, [meta.page, searchQuery, departmentFilter, positionFilter, statusFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get<any>('/departments');
      if (Array.isArray(response)) {
        setDepartments(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setDepartments(response.data);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchDepartments();
  }, [fetchStaff, fetchDepartments]);

  const stats = useMemo(() => {
    const activeCount = staff.filter(s => s.isActive && s.user.status === 'ACTIVE').length;
    const inactiveCount = staff.filter(s => !s.isActive || s.user.status !== 'ACTIVE').length;
    const uniqueDepartments = new Set(staff.map(s => s.department?.id).filter(Boolean)).size;

    return [
      { label: 'Total Staff', value: meta.total.toString(), change: `${staff.length} loaded`, color: 'text-blue-600', bg: 'bg-blue-100' },
      { label: 'Active', value: activeCount.toString(), change: staff.length > 0 ? `${((activeCount / staff.length) * 100).toFixed(1)}%` : '0%', color: 'text-green-600', bg: 'bg-green-100' },
      { label: 'Inactive', value: inactiveCount.toString(), change: staff.length > 0 ? `${((inactiveCount / staff.length) * 100).toFixed(1)}%` : '0%', color: 'text-yellow-600', bg: 'bg-yellow-100' },
      { label: 'Departments', value: uniqueDepartments.toString(), change: '', color: 'text-purple-600', bg: 'bg-purple-100' },
    ];
  }, [staff, meta.total]);

  const handleAddStaff = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.employeeId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.departmentId) {
      toast.error('Please select a department');
      return;
    }

    if (!formData.baseSalary || isNaN(Number(formData.baseSalary))) {
      toast.error('Please enter a valid base salary');
      return;
    }

    setActionLoading('add');
    try {
      await api.post('/staff', {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        employeeId: formData.employeeId,
        position: formData.position,
        title: formData.title || formData.position,
        employmentType: formData.employmentType,
        departmentId: formData.departmentId,
        hireDate: formData.hireDate,
        baseSalary: Number(formData.baseSalary),
      });

      setAddDialogOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        employeeId: '',
        position: 'JUNIOR',
        title: '',
        employmentType: 'FULL_TIME',
        departmentId: '',
        hireDate: new Date().toISOString().split('T')[0],
        baseSalary: '',
        isTaxable: true,
      });
      toast.success('Staff member added successfully!');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditStaff = async () => {
    if (!selectedStaff) return;

    setActionLoading('edit');
    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        position: formData.position,
        title: formData.title,
        employmentType: formData.employmentType,
        departmentId: formData.departmentId || undefined,
        isTaxable: formData.isTaxable,
      };
      if (formData.baseSalary && !isNaN(Number(formData.baseSalary))) {
        payload.baseSalary = Number(formData.baseSalary);
      }
      await api.put(`/staff/${selectedStaff.id}`, payload);

      setEditDialogOpen(false);
      toast.success('Staff member updated successfully!');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSalary = async () => {
    if (!salaryTarget) return;
    if (!newSalary || isNaN(Number(newSalary)) || Number(newSalary) <= 0) {
      toast.error('Please enter a valid salary amount');
      return;
    }
    setActionLoading('salary');
    try {
      await api.put(`/staff/${salaryTarget.id}`, { baseSalary: Number(newSalary) });
      setSalaryDialogOpen(false);
      toast.success('Salary updated successfully!');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update salary');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleTax = async (member: StaffData) => {
    setActionLoading(member.id + '-tax');
    try {
      const newVal = !(member.isTaxable ?? true);
      await api.put(`/staff/${member.id}`, { isTaxable: newVal });
      toast.success(`Tax ${newVal ? 'enabled' : 'exempted'} for ${member.user.firstName} ${member.user.lastName}`);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update tax status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (staffMember: StaffData) => {
    setActionLoading(staffMember.id);
    const activating = !staffMember.isActive;
    try {
      if (staffMember.isActive) {
        await api.delete(`/staff/${staffMember.id}`);
        toast.success('Staff member deactivated successfully!');
      } else {
        await api.put(`/staff/${staffMember.id}`, { isActive: true });
        toast.success('Staff member activated successfully!');
      }
      // Optimistically update local state immediately so the badge reflects the change
      setStaff(prev => prev.map(s =>
        s.id === staffMember.id
          ? { ...s, isActive: activating, user: { ...s.user, status: activating ? 'ACTIVE' : 'INACTIVE' } }
          : s
      ));
      // Background refresh to sync with server
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteStaff = async (staffMember: StaffData) => {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
      return;
    }

    setActionLoading(staffMember.id);
    try {
      await api.delete(`/users/${staffMember.userId}`);
      toast.success('Staff member deleted successfully!');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff member');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditDialog = (staffMember: StaffData) => {
    setSelectedStaff(staffMember);
    setFormData({
      firstName: staffMember.user.firstName,
      lastName: staffMember.user.lastName,
      email: staffMember.user.email,
      phone: staffMember.user.phone || '',
      password: '',
      employeeId: staffMember.employeeId,
      position: staffMember.position,
      title: staffMember.title,
      employmentType: staffMember.employmentType,
      departmentId: staffMember.department?.id || '',
      hireDate: staffMember.hireDate?.split('T')[0] || '',
      baseSalary: staffMember.baseSalary != null ? String(Number(staffMember.baseSalary)) : '',
      isTaxable: staffMember.isTaxable ?? true,
    });
    setEditDialogOpen(true);
  };

  const openSalaryDialog = (staffMember: StaffData) => {
    setSalaryTarget(staffMember);
    setNewSalary(staffMember.baseSalary != null ? String(Number(staffMember.baseSalary)) : '');
    setSalaryDialogOpen(true);
  };

  const openViewDialog = (staffMember: StaffData) => {
    setSelectedStaff(staffMember);
    setViewDialogOpen(true);
  };

  const openResetPassword = (member: StaffData) => {
    setResetPwdTarget({ userId: member.userId, name: `${member.user.firstName} ${member.user.lastName}` });
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
    setActionLoading('reset-pwd');
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
      setActionLoading(null);
    }
  };

  const handleDownloadStaffTemplate = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${base}/api/v1/staff/import-template`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleBulkImportStaff = async () => {
    if (!importFile) { toast.error('Please select a file first'); return; }
    setImporting(true);
    setImportResults(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const form = new FormData();
      form.append('file', importFile);
      const res = await fetch(`${base}/api/v1/staff/bulk-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      const result = data.data || data;
      setImportResults(result);
      if (result.created > 0) { toast.success(`Import complete: ${result.created} created`); fetchStaff(); }
      else { toast.info(`Import complete: no new records created`); }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Employee ID', 'Position', 'Department', 'Employment Type', 'Status', 'Hire Date'];
    const csvContent = [
      headers.join(','),
      ...staff.map(s => [
        `"${s.user.firstName} ${s.user.lastName}"`,
        s.user.email,
        s.employeeId,
        s.position,
        s.department?.name || 'N/A',
        s.employmentType,
        s.isActive ? 'Active' : 'Inactive',
        s.hireDate?.split('T')[0] || '',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Staff data exported successfully!');
  };

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage all staff members and their roles</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchStaff} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setImportFile(null); setImportResults(null); setImportOpen(true); }}>
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm font-medium">{stat.label}</p>
                {stat.change && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
            <SelectItem value="director">Director</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="team_lead">Team Lead</SelectItem>
            <SelectItem value="senior">Senior</SelectItem>
            <SelectItem value="junior">Junior</SelectItem>
            <SelectItem value="intern">Intern</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Staff Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No staff members found
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            {member.user.avatar && <AvatarImage src={member.user.avatar} />}
                            <AvatarFallback className="bg-primary text-white text-sm">
                              {member.user.firstName[0]}{member.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPositionBadge(member.position)}</TableCell>
                      <TableCell>
                        {member.department ? (
                          <button
                            type="button"
                            className="text-primary hover:underline font-medium"
                            onClick={() => setDepartmentFilter(member.department!.id)}
                          >
                            {member.department.name}
                          </button>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{member.employmentType.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-sm font-medium text-left hover:text-primary transition-colors"
                          onClick={() => openSalaryDialog(member)}
                          title="Click to update salary"
                        >
                          {member.baseSalary != null
                            ? `₦${Number(member.baseSalary).toLocaleString()}`
                            : <span className="text-muted-foreground">—</span>}
                        </button>
                      </TableCell>
                      <TableCell>
                        {(member.isTaxable ?? true) ? (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">Taxable</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 text-xs">Exempt</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(member.user.status, member.isActive)}</TableCell>
                      <TableCell className="text-sm">{member.hireDate?.split('T')[0] || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!!actionLoading && actionLoading === member.id}>
                              {actionLoading === member.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreVertical className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openViewDialog(member)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(member)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSalaryDialog(member)}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Update Salary
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleTax(member)}
                              disabled={actionLoading === member.id + '-tax'}
                            >
                              {actionLoading === member.id + '-tax' ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (member.isTaxable ?? true) ? (
                                <ShieldOff className="w-4 h-4 mr-2" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 mr-2" />
                              )}
                              {(member.isTaxable ?? true) ? 'Exempt from Tax' : 'Enable Tax'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPassword(member)}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStatus(member)}>
                              {member.isActive ? (
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
                              onClick={() => handleDeleteStaff(member)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Staff Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  placeholder="EMP-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <select
                  id="position"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                  <option value="INTERN">Intern</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DIRECTOR">Director</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type *</Label>
                <select
                  id="employmentType"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Software Engineer"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <select
                  id="department"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date *</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseSalary">Base Salary *</Label>
              <Input
                id="baseSalary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                placeholder="e.g., 500000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={actionLoading === 'add'}>
              {actionLoading === 'add' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-position">Position *</Label>
                <select
                  id="edit-position"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                  <option value="INTERN">Intern</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DIRECTOR">Director</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employmentType">Employment Type</Label>
                <select
                  id="edit-employmentType"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Job Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <select
                id="edit-department"
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                <option value="">Select department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-baseSalary">Base Salary (₦)</Label>
              <Input
                id="edit-baseSalary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                placeholder="e.g., 500000"
              />
            </div>
            <div className="flex items-center justify-between py-2 px-3 border rounded-md">
              <div>
                <p className="text-sm font-medium">Subject to Income Tax</p>
                <p className="text-xs text-muted-foreground">Toggle off to exempt this staff from payroll tax</p>
              </div>
              <Switch
                checked={formData.isTaxable}
                onCheckedChange={(val) => setFormData({ ...formData, isTaxable: val })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStaff} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Button onClick={handleResetPassword} disabled={actionLoading === 'reset-pwd'}>
                {actionLoading === 'reset-pwd' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
            <DialogTitle>Bulk Import Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">Download the template, fill in staff data, then upload.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadStaffTemplate}>
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
            <Button onClick={handleBulkImportStaff} disabled={!importFile || importing}>
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Salary Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={(open) => { setSalaryDialogOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Salary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {salaryTarget && (
              <p className="text-sm text-muted-foreground">
                Updating salary for <span className="font-medium text-foreground">{salaryTarget.user.firstName} {salaryTarget.user.lastName}</span>
              </p>
            )}
            {salaryTarget?.baseSalary != null && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
                <span className="text-muted-foreground">Current salary: </span>
                <span className="font-semibold">₦{Number(salaryTarget.baseSalary).toLocaleString()}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-salary">New Base Salary (₦) *</Label>
              <Input
                id="new-salary"
                type="number"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                placeholder="e.g., 600000"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateSalary} disabled={actionLoading === 'salary'}>
              {actionLoading === 'salary' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Staff Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  {selectedStaff.user.avatar && <AvatarImage src={selectedStaff.user.avatar} />}
                  <AvatarFallback className="bg-primary text-white text-xl">
                    {selectedStaff.user.firstName[0]}{selectedStaff.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedStaff.user.firstName} {selectedStaff.user.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStaff.title || selectedStaff.position}</p>
                  {getStatusBadge(selectedStaff.user.status, selectedStaff.isActive)}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedStaff.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedStaff.user.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Employee ID</p>
                  <p className="font-bold">{selectedStaff.employeeId}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-bold">{selectedStaff.position.replace('_', ' ')}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-bold">{selectedStaff.department?.name || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-bold">{selectedStaff.employmentType.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Hire Date</p>
                  <p className="font-bold">{selectedStaff.hireDate?.split('T')[0] || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Direct Reports</p>
                  <p className="font-bold">{selectedStaff._count?.directReports || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Base Salary</p>
                  <p className="font-bold">
                    {selectedStaff.baseSalary != null
                      ? `₦${Number(selectedStaff.baseSalary).toLocaleString()}`
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Tax Status</p>
                  <p className="font-bold">
                    {(selectedStaff.isTaxable ?? true) ? (
                      <span className="text-blue-600">Taxable</span>
                    ) : (
                      <span className="text-gray-500">Tax Exempt</span>
                    )}
                  </p>
                </div>
              </div>

              {selectedStaff.manager && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Reports To</p>
                  <p className="font-medium">{selectedStaff.manager.user.firstName} {selectedStaff.manager.user.lastName}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedStaff) openEditDialog(selectedStaff);
            }}>
              Edit Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
