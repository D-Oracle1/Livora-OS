'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building,
  Plus,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface DepartmentData {
  id: string;
  name: string;
  code: string;
  description: string | null;
  role: string;
  allowedModules: string[];
  parentId: string | null;
  headId: string | null;
  parent?: { id: string; name: string } | null;
  head?: {
    id: string;
    user: { firstName: string; lastName: string; avatar: string | null };
  } | null;
  _count?: { staff: number; children: number };
}

// All modules available for selection, grouped by category
const MODULE_CATEGORIES = [
  {
    category: 'HR & People',
    modules: [
      { key: 'attendance', label: 'Attendance Tracking' },
      { key: 'leave', label: 'Leave Management' },
      { key: 'performance', label: 'Performance Reviews' },
      { key: 'staff_payroll', label: 'Staff Payroll' },
      { key: 'realtor_payroll', label: 'Realtor Payroll' },
      { key: 'policies', label: 'Policies & Penalties' },
      { key: 'salary_config', label: 'Salary Configuration' },
      { key: 'tasks', label: 'Task Management' },
      { key: 'hr_hub', label: 'HR Hub' },
    ],
  },
  {
    category: 'Sales & Finance',
    modules: [
      { key: 'properties', label: 'Properties' },
      { key: 'sales', label: 'Sales' },
      { key: 'commission', label: 'Commission' },
      { key: 'tax', label: 'Tax Reports' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'rankings', label: 'Rankings' },
    ],
  },
  {
    category: 'Content & Communications',
    modules: [
      { key: 'cms', label: 'CMS' },
      { key: 'gallery', label: 'Gallery' },
      { key: 'channels', label: 'Team Channels' },
      { key: 'chat', label: 'Chat' },
      { key: 'support', label: 'Support Chats' },
      { key: 'engagement', label: 'Engagement / Feed' },
      { key: 'newsletter', label: 'Newsletter' },
    ],
  },
  {
    category: 'People Management',
    modules: [
      { key: 'staff', label: 'Staff' },
      { key: 'realtors', label: 'Realtors' },
      { key: 'clients', label: 'Clients' },
      { key: 'departments', label: 'Departments' },
      { key: 'team', label: 'Team View' },
    ],
  },
  {
    category: 'System',
    modules: [
      { key: 'audit', label: 'Audit Logs' },
      { key: 'referrals', label: 'Referral Tracking' },
      { key: 'notifications', label: 'Notifications' },
      { key: 'files', label: 'Files' },
    ],
  },
];

const COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-pink-500',
];

// Roles that can be assigned to a department (excludes SUPER_ADMIN and CLIENT)
const DEPARTMENT_ROLES = [
  { value: 'STAFF', label: 'Staff', description: 'Standard staff access' },
  { value: 'HR', label: 'HR', description: 'HR dashboard & people management' },
  { value: 'ADMIN', label: 'Admin', description: 'Full admin dashboard access' },
  { value: 'GENERAL_OVERSEER', label: 'General Overseer', description: 'Oversight & executive access' },
  { value: 'REALTOR', label: 'Realtor', description: 'Property sales & commission access' },
];

const roleBadge: Record<string, string> = {
  STAFF: 'bg-gray-100 text-gray-700 border-gray-200',
  HR: 'bg-teal-100 text-teal-700 border-teal-200',
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  GENERAL_OVERSEER: 'bg-purple-100 text-purple-700 border-purple-200',
  REALTOR: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentData | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRole, setFormRole] = useState('STAFF');
  const [formAllowedModules, setFormAllowedModules] = useState<string[]>([]);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await api.get('/departments');
      const data = response.data || response;
      setDepartments(Array.isArray(data) ? data : (data as any).data || []);
    } catch (error: any) {
      console.error('Failed to fetch departments:', error);
      toast.error(error.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const totalStaff = useMemo(
    () => departments.reduce((sum, d) => sum + (d._count?.staff || 0), 0),
    [departments],
  );

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormRole('STAFF');
    setFormAllowedModules([]);
  };

  const toggleModule = (key: string) => {
    setFormAllowedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleAddDepartment = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Please fill in name and code');
      return;
    }

    setActionLoading('add');
    try {
      await api.post('/departments', {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim() || undefined,
        role: formRole,
        allowedModules: formAllowedModules,
      });
      setAddDialogOpen(false);
      resetForm();
      toast.success('Department created successfully!');
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create department');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditDepartment = async () => {
    if (!selectedDept || !formName.trim()) {
      toast.error('Please fill in the department name');
      return;
    }

    setActionLoading('edit');
    try {
      await api.put(`/departments/${selectedDept.id}`, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        role: formRole,
        allowedModules: formAllowedModules,
      });
      setEditDialogOpen(false);
      resetForm();
      toast.success('Department updated successfully!');
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update department');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDepartment = async (dept: DepartmentData) => {
    if (!confirm(`Are you sure you want to delete "${dept.name}"? This cannot be undone.`)) {
      return;
    }

    setActionLoading(dept.id);
    try {
      await api.delete(`/departments/${dept.id}`);
      toast.success('Department deleted successfully!');
      fetchDepartments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete department');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditDialog = (dept: DepartmentData) => {
    setSelectedDept(dept);
    setFormName(dept.name);
    setFormCode(dept.code);
    setFormDescription(dept.description || '');
    setFormRole(dept.role || 'STAFF');
    setFormAllowedModules(dept.allowedModules || []);
    setEditDialogOpen(true);
  };

  if (loading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage organizational departments and structure</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchDepartments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => { resetForm(); setAddDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            Add Department
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{departments.length}</p>
              <p className="text-sm text-muted-foreground">Total Departments</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{totalStaff}</p>
              <p className="text-sm text-muted-foreground">Total Staff Across Departments</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Department Cards */}
      {departments.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No departments yet</p>
            <p className="text-sm mb-4">Create your first department to start organizing your staff.</p>
            <Button onClick={() => { resetForm(); setAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Department
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept, index) => {
            const color = COLORS[index % COLORS.length];
            const headName = dept.head?.user
              ? `${dept.head.user.firstName} ${dept.head.user.lastName}`
              : null;
            const headInitials = dept.head?.user
              ? `${dept.head.user.firstName[0]}${dept.head.user.lastName[0]}`
              : null;
            const deptRole = dept.role || 'STAFF';
            const roleLabel = DEPARTMENT_ROLES.find(r => r.value === deptRole)?.label || deptRole;

            return (
              <motion.div
                key={dept.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/dashboard/admin/staff?department=${dept.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
                          <Building className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{dept.name}</h3>
                          <Badge variant="secondary" className="text-xs">{dept.code}</Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={actionLoading === dept.id}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {actionLoading === dept.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(dept); }}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(dept); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-muted-foreground mb-3">{dept.description}</p>
                    )}

                    <div className="space-y-3">
                      {/* Role + module count badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${roleBadge[deptRole] || roleBadge.STAFF}`}
                          >
                            {roleLabel} role
                          </span>
                        </div>
                        {(dept.allowedModules?.length ?? 0) > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-indigo-50 text-indigo-700 border-indigo-200">
                            {dept.allowedModules.length} module{dept.allowedModules.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">All modules</span>
                        )}
                      </div>

                      {headName && (
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary text-white text-xs">
                              {headInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-muted-foreground">Department Head</p>
                            <p className="text-sm font-medium">{headName}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{dept._count?.staff || 0} staff</span>
                        </div>
                        {dept.parent && (
                          <Badge variant="outline" className="text-xs">
                            Under: {dept.parent.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reusable module picker — rendered inside both dialogs */}
      {/* Add Department Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-1">
            <div className="space-y-4 py-2 pr-2">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Department Name *</Label>
                <Input
                  id="dept-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Communications"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-code">Department Code *</Label>
                <Input
                  id="dept-code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g., COMMS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-description">Description</Label>
                <Input
                  id="dept-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of the department"
                />
              </div>
              <div className="space-y-2">
                <Label>Staff Role</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role for this department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {r.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Staff created here automatically get this role and its dashboard.
                </p>
              </div>

              {/* Module Access */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Module Access</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAllowedModules(MODULE_CATEGORIES.flatMap(c => c.modules.map(m => m.key)))}
                      className="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => setFormAllowedModules([])}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  {formAllowedModules.length === 0
                    ? 'No restriction — staff see all modules for their role.'
                    : `${formAllowedModules.length} module${formAllowedModules.length !== 1 ? 's' : ''} selected — staff only see these in their sidebar.`}
                </p>
                <div className="space-y-3">
                  {MODULE_CATEGORIES.map((cat) => (
                    <Card key={cat.category} className="border border-gray-100">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat.category}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 pt-0 grid grid-cols-2 gap-1.5">
                        {cat.modules.map((mod) => (
                          <label key={mod.key} className="flex items-center gap-2 cursor-pointer group">
                            <Checkbox
                              checked={formAllowedModules.includes(mod.key)}
                              onCheckedChange={() => toggleModule(mod.key)}
                            />
                            <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
                              {mod.label}
                            </span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDepartment} disabled={actionLoading === 'add'}>
              {actionLoading === 'add' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-1">
            <div className="space-y-4 py-2 pr-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dept-name">Department Name *</Label>
                <Input
                  id="edit-dept-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dept-code">Department Code</Label>
                <Input
                  id="edit-dept-code"
                  value={formCode}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dept-description">Description</Label>
                <Input
                  id="edit-dept-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Staff Role</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role for this department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {r.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing the role affects new staff only. Existing staff keep their current role unless transferred.
                </p>
              </div>

              {/* Module Access */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Module Access</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAllowedModules(MODULE_CATEGORIES.flatMap(c => c.modules.map(m => m.key)))}
                      className="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => setFormAllowedModules([])}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  {formAllowedModules.length === 0
                    ? 'No restriction — staff see all modules for their role.'
                    : `${formAllowedModules.length} module${formAllowedModules.length !== 1 ? 's' : ''} selected — staff only see these in their sidebar.`}
                </p>
                <div className="space-y-3">
                  {MODULE_CATEGORIES.map((cat) => (
                    <Card key={cat.category} className="border border-gray-100">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat.category}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 pt-0 grid grid-cols-2 gap-1.5">
                        {cat.modules.map((mod) => (
                          <label key={mod.key} className="flex items-center gap-2 cursor-pointer group">
                            <Checkbox
                              checked={formAllowedModules.includes(mod.key)}
                              onCheckedChange={() => toggleModule(mod.key)}
                            />
                            <span className="text-sm group-hover:text-foreground text-muted-foreground transition-colors">
                              {mod.label}
                            </span>
                          </label>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDepartment} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
