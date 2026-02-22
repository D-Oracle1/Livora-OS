'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Permission {
  resource: string;
  action: string;
  scope?: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  _count: { staffProfiles: number };
}

// ---------------------------------------------------------------------------
// Available resources & actions
// ---------------------------------------------------------------------------

const RESOURCE_GROUPS: { label: string; resources: { key: string; label: string }[] }[] = [
  {
    label: 'Sales & Properties',
    resources: [
      { key: 'sales', label: 'Sales' },
      { key: 'properties', label: 'Properties' },
      { key: 'commission', label: 'Commission' },
      { key: 'tax', label: 'Tax' },
    ],
  },
  {
    label: 'People',
    resources: [
      { key: 'clients', label: 'Clients' },
      { key: 'realtors', label: 'Realtors' },
      { key: 'staff', label: 'Staff' },
      { key: 'departments', label: 'Departments' },
    ],
  },
  {
    label: 'HR',
    resources: [
      { key: 'attendance', label: 'Attendance' },
      { key: 'leave', label: 'Leave' },
      { key: 'performance', label: 'Performance' },
      { key: 'payroll', label: 'Payroll' },
      { key: 'policies', label: 'Policies' },
    ],
  },
  {
    label: 'Content & System',
    resources: [
      { key: 'cms', label: 'CMS' },
      { key: 'gallery', label: 'Gallery' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'audit', label: 'Audit Logs' },
    ],
  },
];

const ACTIONS = ['read', 'write', 'delete', 'manage'] as const;

// ---------------------------------------------------------------------------
// Permission matrix helpers
// ---------------------------------------------------------------------------

type PermMatrix = Record<string, Set<string>>;

function permsToMatrix(perms: Permission[]): PermMatrix {
  const m: PermMatrix = {};
  for (const p of perms) {
    if (!m[p.resource]) m[p.resource] = new Set();
    m[p.resource].add(p.action);
  }
  return m;
}

function matrixToPerms(matrix: PermMatrix): Permission[] {
  const result: Permission[] = [];
  for (const [resource, actions] of Object.entries(matrix)) {
    for (const action of actions) {
      result.push({ resource, action });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RESOURCE_GROUPS.map((g) => [g.label, true])),
  );

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [permMatrix, setPermMatrix] = useState<PermMatrix>({});

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Role[]>('/roles');
      setRoles(data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreate = () => {
    setEditingRole(null);
    setFormName('');
    setFormDesc('');
    setPermMatrix({});
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDesc(role.description ?? '');
    setPermMatrix(permsToMatrix(role.permissions));
    setDialogOpen(true);
  };

  const togglePerm = (resource: string, action: string) => {
    setPermMatrix((prev) => {
      const next = { ...prev };
      const actions = new Set(next[resource] ?? []);

      if (action === 'manage') {
        // Toggle manage = grant/revoke all actions
        if (actions.has('manage')) {
          actions.clear();
        } else {
          ACTIONS.forEach((a) => actions.add(a));
        }
      } else {
        if (actions.has(action)) {
          actions.delete(action);
          actions.delete('manage'); // 'manage' no longer applies if partial
        } else {
          actions.add(action);
          // If all individual actions are checked, also add 'manage'
          const individual = ACTIONS.filter((a) => a !== 'manage');
          if (individual.every((a) => actions.has(a))) {
            actions.add('manage');
          }
        }
      }

      if (actions.size === 0) {
        delete next[resource];
      } else {
        next[resource] = actions;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        permissions: matrixToPerms(permMatrix),
      };

      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, payload);
        toast.success('Role updated');
      } else {
        await api.post('/roles', payload);
        toast.success('Role created');
      }
      setDialogOpen(false);
      fetchRoles();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${deletingRole.id}`);
      toast.success('Role deleted');
      setDeleteDialogOpen(false);
      setDeletingRole(null);
      fetchRoles();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const totalPermCount = (perms: Permission[]) => perms.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Define reusable roles with permission sets for staff members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Role
          </Button>
        </div>
      </div>

      {/* Roles grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No roles yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first role to assign to staff</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role, i) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield className="w-5 h-5 text-primary shrink-0" />
                      <CardTitle className="text-base truncate">{role.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {role.isSystem && (
                        <Badge variant="outline" className="text-[10px]">System</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(role)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          {!role.isSystem && (
                            <DropdownMenuItem
                              className="text-red-500"
                              onClick={() => {
                                setDeletingRole(role);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Role
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {role.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {role.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-0">
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {role.permissions.length === 0 ? (
                      <span className="text-xs text-gray-400">No permissions</span>
                    ) : (
                      role.permissions.slice(0, 6).map((p, pi) => (
                        <Badge key={pi} variant="secondary" className="text-[10px]">
                          {p.resource}:{p.action}
                        </Badge>
                      ))
                    )}
                    {role.permissions.length > 6 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{role.permissions.length - 6} more
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{role._count.staffProfiles} staff assigned</span>
                    <span className="mx-1">·</span>
                    <span>{totalPermCount(role.permissions)} permissions</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sales Manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Permission Matrix */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Permissions</Label>
              <div className="border rounded-xl overflow-hidden divide-y dark:divide-gray-800">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_repeat(4,56px)] gap-0 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Resource</span>
                  {ACTIONS.map((a) => (
                    <span key={a} className="text-center capitalize">
                      {a}
                    </span>
                  ))}
                </div>

                {RESOURCE_GROUPS.map((group) => (
                  <div key={group.label}>
                    {/* Group header */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-1.5 bg-gray-50/60 dark:bg-gray-800/30 text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [group.label]: !prev[group.label],
                        }))
                      }
                    >
                      {expandedGroups[group.label] ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      {group.label}
                    </button>

                    {/* Resource rows */}
                    {expandedGroups[group.label] &&
                      group.resources.map((res) => (
                        <div
                          key={res.key}
                          className="grid grid-cols-[1fr_repeat(4,56px)] gap-0 items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {res.label}
                          </span>
                          {ACTIONS.map((action) => {
                            const checked = permMatrix[res.key]?.has(action) ?? false;
                            return (
                              <div key={action} className="flex justify-center">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => togglePerm(res.key, action)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                "Manage" grants all actions for that resource.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Are you sure you want to delete <strong>{deletingRole?.name}</strong>? This cannot be
            undone. Roles with assigned staff cannot be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
