'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, getImageUrl } from '@/lib/api';
import { toast } from 'sonner';

const ROLES = ['ADMIN', 'REALTOR', 'CLIENT', 'STAFF'];
const ROLE_COLORS: Record<string, string> = {
  GENERAL_OVERSEER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  REALTOR: 'bg-green-100 text-green-800',
  CLIENT: 'bg-gray-100 text-gray-800',
  STAFF: 'bg-orange-100 text-orange-800',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Status change dialog
  const [changeStatusUser, setChangeStatusUser] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState('');
  const [changing, setChanging] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res: any = await api.get(`/users?${params.toString()}`);
      const data = res?.data || res;
      setUsers(Array.isArray(data) ? data : data?.data || []);
      setTotalPages(data?.meta?.totalPages || 1);
      setTotal(data?.meta?.total || 0);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleStatusChange = async () => {
    if (!changeStatusUser || !pendingStatus) return;
    setChanging(true);
    try {
      await api.put(`/users/${changeStatusUser.id}/status`, { status: pendingStatus });
      toast.success(`${changeStatusUser.firstName} ${changeStatusUser.lastName} status updated to ${pendingStatus}`);
      setChangeStatusUser(null);
      setPendingStatus('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setChanging(false);
    }
  };

  const openStatusDialog = (user: any, status: string) => {
    setChangeStatusUser(user);
    setPendingStatus(status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all users including inactive accounts ({total} total)
          </p>
        </div>
        <Users className="w-6 h-6 text-muted-foreground" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === 'ALL' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: total },
          { label: 'Active', value: users.filter(u => u.status === 'ACTIVE').length },
          { label: 'Inactive / Suspended', value: users.filter(u => u.status !== 'ACTIVE').length },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            {user.avatar && <AvatarImage src={getImageUrl(user.avatar)} />}
                            <AvatarFallback className="text-xs">
                              {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.firstName} {user.lastName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[user.role] || ''}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => openStatusDialog(user, 'INACTIVE')}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => openStatusDialog(user, 'ACTIVE')}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      <Dialog open={!!changeStatusUser} onOpenChange={(open) => { if (!open) setChangeStatusUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingStatus === 'ACTIVE' ? 'Activate User' : 'Deactivate User'}</DialogTitle>
            <DialogDescription>
              {pendingStatus === 'ACTIVE'
                ? `Activate ${changeStatusUser?.firstName} ${changeStatusUser?.lastName}? They will be able to log in again.`
                : `Deactivate ${changeStatusUser?.firstName} ${changeStatusUser?.lastName}? They will not be able to log in.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeStatusUser(null)}>Cancel</Button>
            <Button
              variant={pendingStatus === 'ACTIVE' ? 'default' : 'destructive'}
              onClick={handleStatusChange}
              disabled={changing}
            >
              {changing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
