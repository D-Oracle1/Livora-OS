'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Briefcase,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AllowanceConfig {
  id: string;
  name: string;
  type: string;
  description: string | null;
  amountType: string;
  amount: number | string;
  percentageBasis: string | null;
  isActive: boolean;
  positionLevels: string[];
  minServiceMonths: number | null;
  isTaxable: boolean;
}

interface DeductionConfig {
  id: string;
  name: string;
  type: string;
  description: string | null;
  amountType: string;
  amount: number | string;
  percentageBasis: string | null;
  isActive: boolean;
  isMandatory: boolean;
  maxAmount: number | string | null;
}

interface SalaryStructure {
  id: string;
  name: string;
  description: string | null;
  position: string;
  minSalary: number | string;
  maxSalary: number | string;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  overtimeRate: number;
  weekendRate: number;
  holidayRate: number;
  isActive: boolean;
}

const ALLOWANCE_TYPES = ['HOUSING', 'TRANSPORT', 'MEAL', 'MEDICAL', 'COMMUNICATION', 'ENTERTAINMENT', 'EDUCATION', 'OTHER'];
const DEDUCTION_TYPES = ['TAX', 'PENSION', 'HEALTH_INSURANCE', 'LOAN_REPAYMENT', 'LATENESS_PENALTY', 'ABSENCE_PENALTY', 'LATE_TASK_PENALTY', 'OTHER'];
const POSITIONS = ['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'TEAM_LEAD', 'SENIOR', 'JUNIOR', 'INTERN'];

const formatCurrency = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(numAmount);
};

export default function SalaryConfigPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('allowances');

  const [allowances, setAllowances] = useState<AllowanceConfig[]>([]);
  const [deductions, setDeductions] = useState<DeductionConfig[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);

  // Dialog states
  const [allowanceDialogOpen, setAllowanceDialogOpen] = useState(false);
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false);
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);

  const [editingAllowance, setEditingAllowance] = useState<AllowanceConfig | null>(null);
  const [editingDeduction, setEditingDeduction] = useState<DeductionConfig | null>(null);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);

  // Form states
  const [allowanceForm, setAllowanceForm] = useState({
    name: '',
    type: 'HOUSING',
    description: '',
    amountType: 'fixed',
    amount: 0,
    percentageBasis: 'base_salary',
    isActive: true,
    positionLevels: [] as string[],
    minServiceMonths: 0,
    isTaxable: true,
  });

  const [deductionForm, setDeductionForm] = useState({
    name: '',
    type: 'TAX',
    description: '',
    amountType: 'percentage',
    amount: 0,
    percentageBasis: 'gross_salary',
    isActive: true,
    isMandatory: false,
    maxAmount: 0,
  });

  const [structureForm, setStructureForm] = useState({
    name: '',
    description: '',
    position: 'JUNIOR',
    minSalary: 0,
    maxSalary: 0,
    workHoursPerDay: 8,
    workDaysPerWeek: 5,
    overtimeRate: 1.5,
    weekendRate: 2.0,
    holidayRate: 2.5,
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allowancesRes, deductionsRes, structuresRes] = await Promise.allSettled([
        api.get('/hr/salary-config/allowances'),
        api.get('/hr/salary-config/deductions'),
        api.get('/hr/salary-config/structures'),
      ]);

      if (allowancesRes.status === 'fulfilled') {
        const data = allowancesRes.value?.data || allowancesRes.value || [];
        setAllowances(Array.isArray(data) ? data : []);
      }
      if (deductionsRes.status === 'fulfilled') {
        const data = deductionsRes.value?.data || deductionsRes.value || [];
        setDeductions(Array.isArray(data) ? data : []);
      }
      if (structuresRes.status === 'fulfilled') {
        const data = structuresRes.value?.data || structuresRes.value || [];
        setStructures(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch salary config:', err);
      toast.error(err.message || 'Failed to load salary configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Allowance handlers
  const openAllowanceDialog = (allowance?: AllowanceConfig) => {
    if (allowance) {
      setEditingAllowance(allowance);
      setAllowanceForm({
        name: allowance.name,
        type: allowance.type,
        description: allowance.description || '',
        amountType: allowance.amountType,
        amount: Number(allowance.amount),
        percentageBasis: allowance.percentageBasis || 'base_salary',
        isActive: allowance.isActive,
        positionLevels: allowance.positionLevels || [],
        minServiceMonths: allowance.minServiceMonths || 0,
        isTaxable: allowance.isTaxable,
      });
    } else {
      setEditingAllowance(null);
      setAllowanceForm({
        name: '',
        type: 'HOUSING',
        description: '',
        amountType: 'fixed',
        amount: 0,
        percentageBasis: 'base_salary',
        isActive: true,
        positionLevels: [],
        minServiceMonths: 0,
        isTaxable: true,
      });
    }
    setAllowanceDialogOpen(true);
  };

  const saveAllowance = async () => {
    if (!allowanceForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setActionLoading('allowance');
    try {
      if (editingAllowance) {
        await api.put(`/hr/salary-config/allowances/${editingAllowance.id}`, allowanceForm);
        toast.success('Allowance updated');
      } else {
        await api.post('/hr/salary-config/allowances', allowanceForm);
        toast.success('Allowance created');
      }
      setAllowanceDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save allowance');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteAllowance = async (id: string) => {
    if (!confirm('Delete this allowance?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/hr/salary-config/allowances/${id}`);
      toast.success('Allowance deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  // Deduction handlers
  const openDeductionDialog = (deduction?: DeductionConfig) => {
    if (deduction) {
      setEditingDeduction(deduction);
      setDeductionForm({
        name: deduction.name,
        type: deduction.type,
        description: deduction.description || '',
        amountType: deduction.amountType,
        amount: Number(deduction.amount),
        percentageBasis: deduction.percentageBasis || 'gross_salary',
        isActive: deduction.isActive,
        isMandatory: deduction.isMandatory,
        maxAmount: deduction.maxAmount ? Number(deduction.maxAmount) : 0,
      });
    } else {
      setEditingDeduction(null);
      setDeductionForm({
        name: '',
        type: 'TAX',
        description: '',
        amountType: 'percentage',
        amount: 0,
        percentageBasis: 'gross_salary',
        isActive: true,
        isMandatory: false,
        maxAmount: 0,
      });
    }
    setDeductionDialogOpen(true);
  };

  const saveDeduction = async () => {
    if (!deductionForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setActionLoading('deduction');
    try {
      if (editingDeduction) {
        await api.put(`/hr/salary-config/deductions/${editingDeduction.id}`, deductionForm);
        toast.success('Deduction updated');
      } else {
        await api.post('/hr/salary-config/deductions', deductionForm);
        toast.success('Deduction created');
      }
      setDeductionDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save deduction');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteDeduction = async (id: string) => {
    if (!confirm('Delete this deduction?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/hr/salary-config/deductions/${id}`);
      toast.success('Deduction deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  // Structure handlers
  const openStructureDialog = (structure?: SalaryStructure) => {
    if (structure) {
      setEditingStructure(structure);
      setStructureForm({
        name: structure.name,
        description: structure.description || '',
        position: structure.position,
        minSalary: Number(structure.minSalary),
        maxSalary: Number(structure.maxSalary),
        workHoursPerDay: structure.workHoursPerDay,
        workDaysPerWeek: structure.workDaysPerWeek,
        overtimeRate: structure.overtimeRate,
        weekendRate: structure.weekendRate,
        holidayRate: structure.holidayRate,
        isActive: structure.isActive,
      });
    } else {
      setEditingStructure(null);
      setStructureForm({
        name: '',
        description: '',
        position: 'JUNIOR',
        minSalary: 0,
        maxSalary: 0,
        workHoursPerDay: 8,
        workDaysPerWeek: 5,
        overtimeRate: 1.5,
        weekendRate: 2.0,
        holidayRate: 2.5,
        isActive: true,
      });
    }
    setStructureDialogOpen(true);
  };

  const saveStructure = async () => {
    if (!structureForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setActionLoading('structure');
    try {
      if (editingStructure) {
        await api.put(`/hr/salary-config/structures/${editingStructure.id}`, structureForm);
        toast.success('Structure updated');
      } else {
        await api.post('/hr/salary-config/structures', structureForm);
        toast.success('Structure created');
      }
      setStructureDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save structure');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteStructure = async (id: string) => {
    if (!confirm('Delete this salary structure?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/hr/salary-config/structures/${id}`);
      toast.success('Structure deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && allowances.length === 0) {
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
          <h1 className="text-2xl font-bold">Salary Configuration</h1>
          <p className="text-muted-foreground">Configure allowances, deductions, and salary structures</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allowances.filter((a) => a.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Active Allowances</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-100">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deductions.filter((d) => d.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Active Deductions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{structures.filter((s) => s.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Salary Structures</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allowances">Allowances</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
        </TabsList>

        {/* Allowances Tab */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Allowance Types
              </CardTitle>
              <Button size="sm" className="gap-2" onClick={() => openAllowanceDialog()}>
                <Plus className="w-4 h-4" />
                Add Allowance
              </Button>
            </CardHeader>
            <CardContent>
              {allowances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No allowances configured</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Taxable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowances.map((allowance) => (
                      <TableRow key={allowance.id}>
                        <TableCell className="font-medium">{allowance.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{allowance.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {allowance.amountType === 'fixed'
                            ? formatCurrency(allowance.amount)
                            : `${allowance.amount}%`}
                        </TableCell>
                        <TableCell>{allowance.isTaxable ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Badge variant={allowance.isActive ? 'default' : 'secondary'}>
                            {allowance.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openAllowanceDialog(allowance)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => deleteAllowance(allowance.id)}
                            disabled={actionLoading === allowance.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Deduction Types
              </CardTitle>
              <Button size="sm" className="gap-2" onClick={() => openDeductionDialog()}>
                <Plus className="w-4 h-4" />
                Add Deduction
              </Button>
            </CardHeader>
            <CardContent>
              {deductions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No deductions configured</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mandatory</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductions.map((deduction) => (
                      <TableRow key={deduction.id}>
                        <TableCell className="font-medium">{deduction.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deduction.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {deduction.amountType === 'fixed'
                            ? formatCurrency(deduction.amount)
                            : `${deduction.amount}%`}
                        </TableCell>
                        <TableCell>{deduction.isMandatory ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Badge variant={deduction.isActive ? 'default' : 'secondary'}>
                            {deduction.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDeductionDialog(deduction)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => deleteDeduction(deduction.id)}
                            disabled={actionLoading === deduction.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structures Tab */}
        <TabsContent value="structures">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Salary Structures
              </CardTitle>
              <Button size="sm" className="gap-2" onClick={() => openStructureDialog()}>
                <Plus className="w-4 h-4" />
                Add Structure
              </Button>
            </CardHeader>
            <CardContent>
              {structures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No salary structures configured</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Salary Range</TableHead>
                      <TableHead>Overtime Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {structures.map((structure) => (
                      <TableRow key={structure.id}>
                        <TableCell className="font-medium">{structure.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{structure.position}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(structure.minSalary)} - {formatCurrency(structure.maxSalary)}
                        </TableCell>
                        <TableCell>{structure.overtimeRate}x</TableCell>
                        <TableCell>
                          <Badge variant={structure.isActive ? 'default' : 'secondary'}>
                            {structure.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openStructureDialog(structure)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => deleteStructure(structure.id)}
                            disabled={actionLoading === structure.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Allowance Dialog */}
      <Dialog open={allowanceDialogOpen} onOpenChange={setAllowanceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAllowance ? 'Edit Allowance' : 'Add Allowance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={allowanceForm.name}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={allowanceForm.type} onValueChange={(v) => setAllowanceForm({ ...allowanceForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALLOWANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount Type</Label>
                <Select value={allowanceForm.amountType} onValueChange={(v) => setAllowanceForm({ ...allowanceForm, amountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{allowanceForm.amountType === 'fixed' ? 'Amount (NGN)' : 'Percentage (%)'}</Label>
                <Input
                  type="number"
                  value={allowanceForm.amount}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={allowanceForm.isActive}
                  onCheckedChange={(c) => setAllowanceForm({ ...allowanceForm, isActive: c })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={allowanceForm.isTaxable}
                  onCheckedChange={(c) => setAllowanceForm({ ...allowanceForm, isTaxable: c })}
                />
                <Label>Taxable</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllowanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAllowance} disabled={actionLoading === 'allowance'}>
              {actionLoading === 'allowance' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deduction Dialog */}
      <Dialog open={deductionDialogOpen} onOpenChange={setDeductionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDeduction ? 'Edit Deduction' : 'Add Deduction'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={deductionForm.name}
                  onChange={(e) => setDeductionForm({ ...deductionForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={deductionForm.type} onValueChange={(v) => setDeductionForm({ ...deductionForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEDUCTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount Type</Label>
                <Select value={deductionForm.amountType} onValueChange={(v) => setDeductionForm({ ...deductionForm, amountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{deductionForm.amountType === 'fixed' ? 'Amount (NGN)' : 'Percentage (%)'}</Label>
                <Input
                  type="number"
                  value={deductionForm.amount}
                  onChange={(e) => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={deductionForm.isActive}
                  onCheckedChange={(c) => setDeductionForm({ ...deductionForm, isActive: c })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={deductionForm.isMandatory}
                  onCheckedChange={(c) => setDeductionForm({ ...deductionForm, isMandatory: c })}
                />
                <Label>Mandatory</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductionDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveDeduction} disabled={actionLoading === 'deduction'}>
              {actionLoading === 'deduction' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Structure Dialog */}
      <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingStructure ? 'Edit Salary Structure' : 'Add Salary Structure'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={structureForm.name}
                  onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={structureForm.position} onValueChange={(v) => setStructureForm({ ...structureForm, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Salary (NGN)</Label>
                <Input
                  type="number"
                  value={structureForm.minSalary}
                  onChange={(e) => setStructureForm({ ...structureForm, minSalary: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Salary (NGN)</Label>
                <Input
                  type="number"
                  value={structureForm.maxSalary}
                  onChange={(e) => setStructureForm({ ...structureForm, maxSalary: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Overtime Rate (x)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={structureForm.overtimeRate}
                  onChange={(e) => setStructureForm({ ...structureForm, overtimeRate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Weekend Rate (x)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={structureForm.weekendRate}
                  onChange={(e) => setStructureForm({ ...structureForm, weekendRate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Holiday Rate (x)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={structureForm.holidayRate}
                  onChange={(e) => setStructureForm({ ...structureForm, holidayRate: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={structureForm.isActive}
                onCheckedChange={(c) => setStructureForm({ ...structureForm, isActive: c })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStructureDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveStructure} disabled={actionLoading === 'structure'}>
              {actionLoading === 'structure' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
