'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const CATEGORY_TYPES = [
  { value: 'OPERATIONAL', label: 'Operational', color: 'bg-blue-100 text-blue-700' },
  { value: 'CAPITAL', label: 'Capital', color: 'bg-purple-100 text-purple-700' },
  { value: 'MARKETING', label: 'Marketing', color: 'bg-pink-100 text-pink-700' },
  { value: 'SALARY', label: 'Salary', color: 'bg-green-100 text-green-700' },
  { value: 'UTILITY', label: 'Utility', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'TAX', label: 'Tax', color: 'bg-red-100 text-red-700' },
  { value: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-600' },
];

const typeColor = (type: string) =>
  CATEGORY_TYPES.find((t) => t.value === type)?.color ?? 'bg-gray-100 text-gray-600';
const typeLabel = (type: string) =>
  CATEGORY_TYPES.find((t) => t.value === type)?.label ?? type;

const emptyForm = { name: '', type: 'OTHER', description: '' };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; category?: any }>({ open: false, mode: 'create' });
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api.get<any>('/expense-categories');
      setCategories(Array.isArray(raw?.data ?? raw) ? (raw?.data ?? raw) : []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = () => { setForm({ ...emptyForm }); setDialog({ open: true, mode: 'create' }); };
  const openEdit = (cat: any) => {
    setForm({ name: cat.name, type: cat.type, description: cat.description ?? '' });
    setDialog({ open: true, mode: 'edit', category: cat });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Category name is required');
    setSaving(true);
    try {
      if (dialog.mode === 'create') {
        await api.post('/expense-categories', form);
        toast.success('Category created');
      } else {
        await api.patch(`/expense-categories/${dialog.category.id}`, form);
        toast.success('Category updated');
      }
      setDialog({ open: false, mode: 'create' });
      fetchCategories();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: any) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/expense-categories/${cat.id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Organize expenses into meaningful categories</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Tag className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-400">No categories yet. Create your first one.</p>
            <Button size="sm" onClick={openCreate}>Add Category</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat: any) => (
            <Card key={cat.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Tag className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{cat.name}</p>
                      <Badge className={`text-xs mt-0.5 ${typeColor(cat.type)}`}>{typeLabel(cat.type)}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {cat.description && (
                  <p className="text-xs text-gray-500 mb-3">{cat.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                  <span>{cat.expenseCount ?? 0} expense(s)</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog({ open: false, mode: 'create' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.mode === 'create' ? 'New Category' : 'Edit Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office Supplies" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, mode: 'create' })}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {dialog.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
