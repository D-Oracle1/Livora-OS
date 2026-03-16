'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Percent,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';

interface HRPolicy {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  isAutomatic: boolean;
  penaltyType: string;
  penaltyAmount: number | string;
  penaltyBasis: string | null;
  graceMinutes: number | null;
  maxOccurrences: number | null;
  escalationRate: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
}

const POLICY_TYPES = [
  { value: 'LATENESS', label: 'Lateness', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  { value: 'ABSENCE', label: 'Absence', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'LATE_TASK', label: 'Late Task Submission', icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { value: 'EARLY_DEPARTURE', label: 'Early Departure', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-100' },
  { value: 'DRESS_CODE', label: 'Dress Code Violation', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'MISCONDUCT', label: 'Misconduct', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'OTHER', label: 'Other', icon: Shield, color: 'text-gray-600', bg: 'bg-gray-100' },
];

const formatCurrency = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(numAmount);
};

const getTypeConfig = (type: string) => {
  return POLICY_TYPES.find((t) => t.value === type) || POLICY_TYPES[POLICY_TYPES.length - 1];
};

export default function HRPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [policies, setPolicies] = useState<HRPolicy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<HRPolicy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'LATENESS',
    description: '',
    isActive: true,
    isAutomatic: true,
    penaltyType: 'fixed',
    penaltyAmount: 0,
    penaltyBasis: 'daily_salary',
    graceMinutes: 30,
    maxOccurrences: 5,
    escalationRate: 1.5,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const res: any = await api.get(`/hr/policies?${params.toString()}`);
      const data = res?.data?.data || res?.data || [];
      setPolicies(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch policies:', err);
      toast.error(err.message || 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      type: 'LATENESS',
      description: '',
      isActive: true,
      isAutomatic: true,
      penaltyType: 'fixed',
      penaltyAmount: 0,
      penaltyBasis: 'daily_salary',
      graceMinutes: 30,
      maxOccurrences: 5,
      escalationRate: 1.5,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (policy: HRPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      type: policy.type,
      description: policy.description || '',
      isActive: policy.isActive,
      isAutomatic: policy.isAutomatic,
      penaltyType: policy.penaltyType,
      penaltyAmount: Number(policy.penaltyAmount),
      penaltyBasis: policy.penaltyBasis || 'daily_salary',
      graceMinutes: policy.graceMinutes || 30,
      maxOccurrences: policy.maxOccurrences || 5,
      escalationRate: policy.escalationRate || 1.5,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Policy name is required');
      return;
    }

    setActionLoading('save');
    try {
      if (editingPolicy) {
        await api.put(`/hr/policies/${editingPolicy.id}`, formData);
        toast.success('Policy updated successfully');
      } else {
        await api.post('/hr/policies', formData);
        toast.success('Policy created successfully');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save policy');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (policy: HRPolicy) => {
    if (!confirm(`Are you sure you want to delete "${policy.name}"?`)) return;

    setActionLoading(policy.id);
    try {
      await api.delete(`/hr/policies/${policy.id}`);
      toast.success('Policy deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete policy');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (policy: HRPolicy) => {
    setActionLoading(policy.id);
    try {
      await api.put(`/hr/policies/${policy.id}`, { isActive: !policy.isActive });
      toast.success(`Policy ${policy.isActive ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update policy');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter by search
  const filteredPolicies = policies.filter((policy) => {
    if (!searchQuery) return true;
    return policy.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Stats
  const stats = [
    { label: 'Total Policies', value: policies.length, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active', value: policies.filter((p) => p.isActive).length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Automatic', value: policies.filter((p) => p.isAutomatic).length, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Lateness Rules', value: policies.filter((p) => p.type === 'LATENESS').length, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  if (loading && policies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">HR Policies & Deduction Rules</h1>
          <p className="text-muted-foreground">Configure automatic penalties for policy violations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            Add Policy
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
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
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
            placeholder="Search policies..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Policy Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {POLICY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Policies Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Deduction Policies
              <Badge variant="secondary">{filteredPolicies.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPolicies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No policies found</p>
                <p className="text-sm">Create your first HR policy to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Penalty</TableHead>
                    <TableHead>Grace Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => {
                    const typeConfig = getTypeConfig(policy.type);
                    return (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{policy.name}</p>
                            {policy.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {policy.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${typeConfig.bg} ${typeConfig.color}`}>
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {policy.penaltyType === 'fixed' ? (
                              <>
                                <NairaSign className="w-4 h-4" />
                                {formatCurrency(policy.penaltyAmount)}
                              </>
                            ) : (
                              <>
                                <Percent className="w-4 h-4" />
                                {policy.penaltyAmount}% of {policy.penaltyBasis?.replace('_', ' ')}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {policy.graceMinutes ? `${policy.graceMinutes} min` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                              {policy.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {policy.isAutomatic && (
                              <Badge variant="outline" className="text-xs">Auto</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(policy)}
                              disabled={actionLoading === policy.id}
                            >
                              {policy.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(policy)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(policy)}
                              disabled={actionLoading === policy.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create Policy'}</DialogTitle>
            <DialogDescription>
              Configure the policy rules and penalty amounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Policy Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lateness Deduction"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this policy..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="penaltyType">Penalty Type *</Label>
                <Select value={formData.penaltyType} onValueChange={(v) => setFormData({ ...formData, penaltyType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="penaltyAmount">
                  {formData.penaltyType === 'fixed' ? 'Amount (NGN)' : 'Percentage (%)'}
                </Label>
                <Input
                  id="penaltyAmount"
                  type="number"
                  value={formData.penaltyAmount}
                  onChange={(e) => setFormData({ ...formData, penaltyAmount: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>

            {formData.penaltyType === 'percentage' && (
              <div className="space-y-2">
                <Label htmlFor="penaltyBasis">Percentage Basis</Label>
                <Select value={formData.penaltyBasis} onValueChange={(v) => setFormData({ ...formData, penaltyBasis: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily_salary">Daily Salary</SelectItem>
                    <SelectItem value="monthly_salary">Monthly Salary</SelectItem>
                    <SelectItem value="hourly_rate">Hourly Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="graceMinutes">Grace Period (min)</Label>
                <Input
                  id="graceMinutes"
                  type="number"
                  value={formData.graceMinutes}
                  onChange={(e) => setFormData({ ...formData, graceMinutes: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxOccurrences">Max Occurrences</Label>
                <Input
                  id="maxOccurrences"
                  type="number"
                  value={formData.maxOccurrences}
                  onChange={(e) => setFormData({ ...formData, maxOccurrences: Number(e.target.value) })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalationRate">Escalation Rate</Label>
                <Input
                  id="escalationRate"
                  type="number"
                  step="0.1"
                  value={formData.escalationRate}
                  onChange={(e) => setFormData({ ...formData, escalationRate: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isAutomatic"
                  checked={formData.isAutomatic}
                  onCheckedChange={(checked) => setFormData({ ...formData, isAutomatic: checked })}
                />
                <Label htmlFor="isAutomatic">Apply Automatically</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={actionLoading === 'save'}>
              {actionLoading === 'save' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update' : 'Create'} Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
