'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Clock,
  MessageSquare,
  MoreVertical,
  Calendar,
  Loader2,
  RefreshCw,
  Play,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Upload,
  Link2,
  Plus,
  X,
  FileText,
  ExternalLink,
  Paperclip,
  Send,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api, getImageUrl } from '@/lib/api';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
  creator?: {
    user: { firstName: string; lastName: string };
  };
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

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
  reportDescription: string | null;
  reportLinks: string[];
  attachments: string[];
  assignee?: {
    user: { firstName: string; lastName: string; email: string; avatar: string | null };
    department?: { name: string } | null;
  };
  creator?: {
    user: { firstName: string; lastName: string; avatar: string | null };
  };
  comments: TaskComment[];
}

const columns = [
  { id: 'TODO', title: 'To Do', color: 'bg-gray-500' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'bg-purple-500' },
  { id: 'COMPLETED', title: 'Completed', color: 'bg-green-500' },
  { id: 'BLOCKED', title: 'Blocked', color: 'bg-red-500' },
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-500';
    case 'HIGH':
      return 'bg-orange-500';
    case 'MEDIUM':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-400';
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Urgent</Badge>;
    case 'HIGH':
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">High</Badge>;
    case 'MEDIUM':
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">Medium</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Low</Badge>;
  }
};

const isOverdue = (dueDate: string | null, status: string) => {
  if (!dueDate || status === 'COMPLETED') return false;
  return new Date(dueDate) < new Date();
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Task detail modal state
  const [detailTask, setDetailTask] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Report submission modal state
  const [reportTask, setReportTask] = useState<Task | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportLinks, setReportLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/tasks/my');
      // Handle TransformInterceptor wrapper: { success, data: [...] }
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : [];
      setTasks(list);
    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
      toast.error(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setActionLoading(taskId);
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(`Task moved to ${newStatus.replace('_', ' ').toLowerCase()}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task status');
    } finally {
      setActionLoading(null);
    }
  };

  const viewTaskDetail = async (taskId: string) => {
    setDetailLoading(true);
    setDetailTask(null);
    try {
      const res = await api.get<any>(`/tasks/${taskId}`);
      const data = res?.data || res;
      setDetailTask(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load task details');
    } finally {
      setDetailLoading(false);
    }
  };

  const addCommentToTask = async () => {
    if (!detailTask || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/tasks/${detailTask.id}/comments`, { content: commentText.trim() });
      setCommentText('');
      // Refresh task detail to show new comment
      const res = await api.get<any>(`/tasks/${detailTask.id}`);
      setDetailTask(res?.data || res);
      toast.success('Comment added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const openReportModal = (task: Task) => {
    setReportTask(task);
    setReportDescription('');
    setReportLinks([]);
    setLinkInput('');
    setReportFiles([]);
  };

  const closeReportModal = () => {
    setReportTask(null);
    setReportDescription('');
    setReportLinks([]);
    setLinkInput('');
    setReportFiles([]);
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!reportLinks.includes(url)) {
      setReportLinks((prev) => [...prev, url]);
    }
    setLinkInput('');
  };

  const removeLink = (index: number) => {
    setReportLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setReportFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setReportFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async () => {
    if (!reportTask) return;
    setSubmittingReport(true);
    try {
      let attachmentUrls: string[] = [];

      // Upload files first if any
      if (reportFiles.length > 0) {
        const uploadedUrls = await api.uploadFiles('/upload/task-files', reportFiles);
        attachmentUrls = uploadedUrls;
      }

      await api.post(`/tasks/${reportTask.id}/submit-report`, {
        description: reportDescription || undefined,
        links: reportLinks.length > 0 ? reportLinks : undefined,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });

      toast.success('Report submitted successfully');
      closeReportModal();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  const overdueCount = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;

  if (loading) {
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
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground">Manage and track your assigned tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Task Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {columns.map((column, index) => {
          const count = getTasksByStatus(column.id).length;
          return (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${column.color}`} />
                    <span className="font-medium">{column.title}</span>
                    <Badge variant="secondary" className="ml-auto">{count}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Overdue Warning */}
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-orange-800 dark:text-orange-200">
                You have <strong>{overdueCount}</strong> overdue task{overdueCount > 1 ? 's' : ''}
              </span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Kanban Board */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No tasks assigned</p>
            <p className="text-sm">Tasks assigned to you will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          {columns.map((column, columnIndex) => (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + columnIndex * 0.1 }}
            >
              <Card className="bg-gray-50 dark:bg-gray-900/50 min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    {column.title}
                    <Badge variant="outline" className="ml-auto">
                      {getTasksByStatus(column.id).length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {getTasksByStatus(column.id).map((task, taskIndex) => {
                    const overdue = isOverdue(task.dueDate, task.status);
                    const creatorName = task.creator?.user
                      ? `${task.creator.user.firstName} ${task.creator.user.lastName}`
                      : 'Unknown';
                    const creatorInitials = task.creator?.user
                      ? `${task.creator.user.firstName[0]}${task.creator.user.lastName[0]}`
                      : '??';

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + taskIndex * 0.05 }}
                        className={`p-3 rounded-lg bg-white dark:bg-gray-800 border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                          overdue ? 'border-orange-300 dark:border-orange-700' : ''
                        }`}
                        onClick={() => viewTaskDetail(task.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className={`w-1 h-full min-h-[20px] rounded-full ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1">
                            <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={actionLoading === task.id}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {actionLoading === task.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2" onClick={() => viewTaskDetail(task.id)}>
                                <Eye className="w-4 h-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {task.status === 'TODO' && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                                >
                                  <Play className="w-4 h-4" />
                                  Start Task
                                </DropdownMenuItem>
                              )}
                              {(task.status === 'IN_PROGRESS' || task.status === 'TODO') && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => openReportModal(task)}
                                >
                                  <FileText className="w-4 h-4" />
                                  Submit Report
                                </DropdownMenuItem>
                              )}
                              {task.status === 'IN_REVIEW' && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                                >
                                  <Play className="w-4 h-4" />
                                  Back to Progress
                                </DropdownMenuItem>
                              )}
                              {task.status === 'BLOCKED' && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                                >
                                  <Play className="w-4 h-4" />
                                  Resume Task
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-1 mb-2">
                          {getPriorityBadge(task.priority)}
                          {task.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {task.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{task.tags.length - 2}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className={`flex items-center gap-1 ${overdue ? 'text-orange-600 font-medium' : ''}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                            {overdue && ' (Overdue)'}
                          </div>
                          <div className="flex items-center gap-2">
                            {task._count && task._count.comments > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {task._count.comments}
                              </span>
                            )}
                            <Avatar className="w-5 h-5" title={`Assigned by: ${creatorName}`}>
                              <AvatarFallback className="text-[10px] bg-primary text-white">
                                {creatorInitials}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {getTasksByStatus(column.id).length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      <Dialog open={!!detailTask || detailLoading} onOpenChange={(open) => { if (!open) { setDetailTask(null); setCommentText(''); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : detailTask ? (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 rounded-full self-stretch ${getPriorityColor(detailTask.priority)}`} />
                  <div className="flex-1">
                    <DialogTitle className="text-lg">{detailTask.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      {getPriorityBadge(detailTask.priority)}
                      <Badge variant={
                        detailTask.status === 'COMPLETED' ? 'default' :
                        detailTask.status === 'IN_REVIEW' ? 'secondary' :
                        detailTask.status === 'IN_PROGRESS' ? 'outline' : 'secondary'
                      } className={
                        detailTask.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        detailTask.status === 'IN_REVIEW' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        detailTask.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''
                      }>
                        {detailTask.status.replace('_', ' ')}
                      </Badge>
                      {isOverdue(detailTask.dueDate, detailTask.status) && (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">Overdue</Badge>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Task Description */}
                {detailTask.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-1.5">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailTask.description}</p>
                  </div>
                )}

                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Due:</span>
                    <span className={isOverdue(detailTask.dueDate, detailTask.status) ? 'text-orange-600 font-medium' : ''}>
                      {detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(detailTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {detailTask.creator?.user && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Assigned by:</span>
                      <span>{detailTask.creator.user.firstName} {detailTask.creator.user.lastName}</span>
                    </div>
                  )}
                  {detailTask.completedAt && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{new Date(detailTask.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {detailTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detailTask.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}

                {/* Report Section (if submitted) */}
                {(detailTask.reportDescription || detailTask.reportLinks.length > 0 || detailTask.attachments.length > 0) && (
                  <div className="border rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/10 space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      Submitted Report
                    </h4>
                    {detailTask.reportDescription && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailTask.reportDescription}</p>
                    )}
                    {detailTask.reportLinks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Links</p>
                        {detailTask.reportLinks.map((link, i) => (
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
                    {detailTask.attachments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                        {detailTask.attachments.map((url, i) => {
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
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({detailTask.comments.length})
                  </h4>

                  {detailTask.comments.length > 0 && (
                    <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto">
                      {detailTask.comments.map((comment) => (
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

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addCommentToTask())}
                      disabled={sendingComment}
                    />
                    <Button
                      size="icon"
                      onClick={addCommentToTask}
                      disabled={!commentText.trim() || sendingComment}
                    >
                      {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-1">
                  {(detailTask.status === 'TODO' || detailTask.status === 'IN_PROGRESS') && (
                    <>
                      {detailTask.status === 'TODO' && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => { handleStatusChange(detailTask.id, 'IN_PROGRESS'); setDetailTask(null); }}
                        >
                          <Play className="w-4 h-4" />
                          Start Task
                        </Button>
                      )}
                      <Button
                        className="gap-2"
                        onClick={() => { setDetailTask(null); openReportModal(detailTask as any); }}
                      >
                        <FileText className="w-4 h-4" />
                        Submit Report
                      </Button>
                    </>
                  )}
                  {detailTask.status === 'IN_REVIEW' && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => { handleStatusChange(detailTask.id, 'IN_PROGRESS'); setDetailTask(null); }}
                    >
                      <Play className="w-4 h-4" />
                      Back to Progress
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Report Submission Modal */}
      <Dialog open={!!reportTask} onOpenChange={(open) => !open && closeReportModal()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Task Report</DialogTitle>
            <DialogDescription>
              {reportTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Report Description</label>
              <Textarea
                placeholder="Describe what you did, how you completed the task..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* External Links */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">External Links</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                />
                <Button type="button" size="icon" variant="outline" onClick={addLink} disabled={!linkInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {reportLinks.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {reportLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{link}</span>
                      <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Upload */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Attachments</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip,.rar"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                disabled={reportFiles.length >= 5}
              >
                <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {reportFiles.length >= 5 ? 'Maximum 5 files reached' : 'Click to upload files (max 5, 10MB each)'}
                </p>
              </button>
              {reportFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {reportFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeReportModal} disabled={submittingReport}>
                Cancel
              </Button>
              <Button onClick={handleSubmitReport} disabled={submittingReport}>
                {submittingReport ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
