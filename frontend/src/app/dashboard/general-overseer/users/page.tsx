'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
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

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Role change dialog
  const [changeRoleUser, setChangeRoleUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [changing, setChanging] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

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
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async () => {
    if (!changeRoleUser || !newRole) return;
    setChanging(true);
    try {
      await api.put(`/users/${changeRoleUser.id}/role`, { role: newRole });
      toast.success(`${changeRoleUser.firstName} ${changeRoleUser.lastName} has been updated to ${newRole}`);
      setChangeRoleUser(null);
      setNewRole('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update role');
    } finally {
      setChanging(false);
    }
  };

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await api.put(`/users/${userId}/status`, { status });
      toast.success(`User status updated to ${status}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-sm text-muted-foreground">Promote, demote, and manage all users ({total} total)</p>
        </div>
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
          </div>
        </CardContent>
      </Card>

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
                      <Badge variant={user.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-xs">
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setChangeRoleUser(user); setNewRole(user.role); }}
                        >
                          <ArrowUpDown className="w-3 h-3 mr-1" />
                          Change Role
                        </Button>
                        {user.status === 'ACTIVE' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleStatusChange(user.id, 'SUSPENDED')}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleStatusChange(user.id, 'ACTIVE')}
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
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Role Change Dialog */}
      <Dialog open={!!changeRoleUser} onOpenChange={(open) => { if (!open) setChangeRoleUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {changeRoleUser?.firstName} {changeRoleUser?.lastName} ({changeRoleUser?.email}).
              This will update their access permissions immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Current Role</label>
            <Badge variant="secondary" className={ROLE_COLORS[changeRoleUser?.role] || ''}>
              {changeRoleUser?.role}
            </Badge>
            <label className="text-sm font-medium mb-2 block mt-4">New Role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleUser(null)}>Cancel</Button>
            <Button
              onClick={handleRoleChange}
              disabled={changing || newRole === changeRoleUser?.role}
            >
              {changing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
