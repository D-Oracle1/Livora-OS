'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  Search,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Filter,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  FileText,
  ExternalLink,
  Paperclip,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

interface StaffMember {
  id: string;
  position: string;
  user: { firstName: string; lastName: string; avatar: string | null };
  department: { name: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  tags: string[];
  createdAt: string;
  assignee: StaffMember;
  creator: StaffMember;
  _count?: { comments: number };
}

interface TaskComment {
  id: string;
  authorId: string;
  content: string;
  attachments: string[];
  createdAt: string;
  author?: { firstName: string; lastName: string; avatar: string | null } | null;
}

interface TaskDetail extends Task {
  reportDescription: string | null;
  reportLinks: string[];
  attachments: string[];
  comments: TaskComment[];
}

const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const STATUSES = [
  { value: 'TODO', label: 'To Do', color: 'bg-gray-100 text-gray-700' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-red-100 text-red-700' },
];

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const isOverdue = (dueDate: string | null, status: string) => {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
};

const getPriorityConfig = (priority: string) => {
  return PRIORITIES.find((p) => p.value === priority) || PRIORITIES[1];
};

const getStatusConfig = (status: string) => {
  return STATUSES.find((s) => s.value === status) || STATUSES[0];
};

export default function AdminTasksPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'MEDIUM',
    dueDate: '',
    tags: '',
  });

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const [tasksRes, staffRes] = await Promise.allSettled([
        api.get(`/tasks?${params.toString()}`),
        api.get('/staff?limit=100'),
      ]);

      if (tasksRes.status === 'fulfilled') {
        const data = tasksRes.value?.data?.data || tasksRes.value?.data || [];
        setTasks(Array.isArray(data) ? data : []);
      }

      if (staffRes.status === 'fulfilled') {
        const data = staffRes.value?.data?.data || staffRes.value?.data || [];
        setStaffList(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
      toast.error(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assigneeId: '',
      priority: 'MEDIUM',
      dueDate: '',
      tags: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assigneeId: task.assignee.id,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      tags: task.tags.join(', '),
    });
    setDialogOpen(true);
  };

  const openViewDialog = async (task: Task) => {
    setSelectedTask(task);
    setTaskDetail(null);
    setCommentText('');
    setViewDialogOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get<any>(`/tasks/${task.id}`);
      const data = res?.data || res;
      setTaskDetail(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load task details');
    } finally {
      setDetailLoading(false);
    }
  };

  const addAdminComment = async () => {
    if (!taskDetail || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/tasks/${taskDetail.id}/comments`, { content: commentText.trim() });
      setCommentText('');
      const res = await api.get<any>(`/tasks/${taskDetail.id}`);
      setTaskDetail(res?.data || res);
      toast.success('Comment added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.assigneeId) {
      toast.error('Please select an assignee');
      return;
    }

    setActionLoading('save');
    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        assigneeId: formData.assigneeId,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, payload);
        toast.success('Task updated');
      } else {
        await api.post('/tasks', payload);
        toast.success('Task created');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save task');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    setActionLoading(task.id);
    try {
      await api.put(`/tasks/${task.id}/status`, { status: newStatus });
      toast.success('Status updated');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;

    setActionLoading(task.id);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Task deleted');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const stats = [
    { label: 'Total Tasks', value: tasks.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'In Progress', value: tasks.filter((t) => t.status === 'IN_PROGRESS').length, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Completed', value: tasks.filter((t) => t.status === 'COMPLETED').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Overdue', value: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  if (loading && tasks.length === 0) {
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
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-muted-foreground">Create and assign tasks to staff members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            Create Task
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
            placeholder="Search tasks..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Tasks
              <Badge variant="secondary">{tasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No tasks found</p>
                <p className="text-sm">Create your first task to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const priorityConfig = getPriorityConfig(task.priority);
                    const statusConfig = getStatusConfig(task.status);
                    const overdue = isOverdue(task.dueDate, task.status);

                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                {task.description}
                              </p>
                            )}
                            {task._count?.comments ? (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MessageSquare className="w-3 h-3" />
                                {task._count.comments}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              {task.assignee?.user?.avatar && (
                                <AvatarImage src={getImageUrl(task.assignee.user.avatar)} />
                              )}
                              <AvatarFallback className="bg-primary text-white text-xs">
                                {task.assignee?.user?.firstName?.[0]}
                                {task.assignee?.user?.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {task.assignee?.user?.firstName} {task.assignee?.user?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {task.assignee?.department?.name || '-'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(v) => handleStatusChange(task, v)}
                            disabled={actionLoading === task.id}
                          >
                            <SelectTrigger className="w-full sm:w-[130px] h-8">
                              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className={overdue ? 'text-red-600 font-medium' : ''}>
                            {formatDate(task.dueDate)}
                            {overdue && (
                              <span className="block text-xs">Overdue</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openViewDialog(task)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(task)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleDelete(task)}
                              disabled={actionLoading === task.id}
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update task details' : 'Assign a new task to a staff member'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Task description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign To *</Label>
                <Select value={formData.assigneeId} onValueChange={(v) => setFormData({ ...formData, assigneeId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.user.firstName} {staff.user.lastName} - {staff.department?.name || 'No Dept'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="urgent, frontend, bug"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={actionLoading === 'save'}>
              {actionLoading === 'save' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTask ? 'Update' : 'Create'} Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) { setTaskDetail(null); setCommentText(''); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (taskDetail || selectedTask) && (
            <div className="space-y-4 py-2">
              <div>
                <h3 className="text-lg font-semibold">{(taskDetail || selectedTask)!.title}</h3>
                {(taskDetail || selectedTask)!.description && (
                  <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{(taskDetail || selectedTask)!.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={getPriorityConfig((taskDetail || selectedTask)!.priority).color}>
                  {getPriorityConfig((taskDetail || selectedTask)!.priority).label}
                </Badge>
                <Badge className={getStatusConfig((taskDetail || selectedTask)!.status).color}>
                  {getStatusConfig((taskDetail || selectedTask)!.status).label}
                </Badge>
                {(taskDetail || selectedTask)!.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {(taskDetail || selectedTask)!.assignee?.user?.firstName?.[0]}
                        {(taskDetail || selectedTask)!.assignee?.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {(taskDetail || selectedTask)!.assignee?.user?.firstName} {(taskDetail || selectedTask)!.assignee?.user?.lastName}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-white text-xs">
                        {(taskDetail || selectedTask)!.creator?.user?.firstName?.[0]}
                        {(taskDetail || selectedTask)!.creator?.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {(taskDetail || selectedTask)!.creator?.user?.firstName} {(taskDetail || selectedTask)!.creator?.user?.lastName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className={`font-medium ${isOverdue((taskDetail || selectedTask)!.dueDate, (taskDetail || selectedTask)!.status) ? 'text-red-600' : ''}`}>
                    {formatDate((taskDetail || selectedTask)!.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate((taskDetail || selectedTask)!.createdAt)}</p>
                </div>
              </div>
              {(taskDetail || selectedTask)!.completedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium text-green-600">{formatDate((taskDetail || selectedTask)!.completedAt)}</p>
                </div>
              )}

              {/* Report Section */}
              {taskDetail && (taskDetail.reportDescription || taskDetail.reportLinks.length > 0 || taskDetail.attachments.length > 0) && (
                <div className="border rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/10 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Staff Report
                  </h4>
                  {taskDetail.reportDescription && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{taskDetail.reportDescription}</p>
                  )}
                  {taskDetail.reportLinks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Links</p>
                      {taskDetail.reportLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{link}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {taskDetail.attachments.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                      {taskDetail.attachments.map((url, i) => {
                        const filename = url.split('/').pop() || `File ${i + 1}`;
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{filename}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Comments Section */}
              {taskDetail && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({taskDetail.comments.length})
                  </h4>
                  {taskDetail.comments.length > 0 && (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {taskDetail.comments.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          {comment.author && (
                            <p className="text-xs font-medium mb-1">
                              {comment.author.firstName} {comment.author.lastName}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                            {new Date(comment.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addAdminComment())}
                      disabled={sendingComment}
                    />
                    <Button
                      size="icon"
                      onClick={addAdminComment}
                      disabled={!commentText.trim() || sendingComment}
                    >
                      {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedTask) openEditDialog(selectedTask);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
