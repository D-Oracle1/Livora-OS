'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Loader2, Search, Building2, ArrowLeft, CheckCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface SupportThread {
  id: string;
  status: string;
  updatedAt: string;
  company: { id: string; name: string; logo?: string; domain: string };
  messages: SupportMessage[];
}

interface SupportMessage {
  id: string;
  content: string;
  senderType: string; // "company_admin" | "super_admin"
  senderId: string;
  senderName: string;
  createdAt: string;
}

export default function SuperAdminSupportPage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [search, setSearch] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res: any = await api.get('/master/support/threads');
      setThreads(Array.isArray(res) ? res : res?.data || res || []);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      const res: any = await api.get(`/master/support/thread/${threadId}/messages`);
      setMessages(Array.isArray(res) ? res : res?.data || res || []);
    } catch {
      // silent
    }
  }, []);

  const selectThread = useCallback(async (thread: SupportThread) => {
    setSelectedThread(thread);
    setShowMobileChat(true);
    setLoadingMessages(true);
    await fetchMessages(thread.id);
    setLoadingMessages(false);
  }, [fetchMessages]);

  // Poll messages when a thread is selected
  useEffect(() => {
    if (!selectedThread) return;

    let msgInterval: ReturnType<typeof setInterval> | null = null;
    let threadInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      msgInterval = setInterval(() => fetchMessages(selectedThread.id), 6000);
      threadInterval = setInterval(fetchThreads, 20000);
    };

    const stopPolling = () => {
      if (msgInterval) { clearInterval(msgInterval); msgInterval = null; }
      if (threadInterval) { clearInterval(threadInterval); threadInterval = null; }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchMessages(selectedThread.id);
        fetchThreads();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedThread, fetchMessages, fetchThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const res: any = await api.post(`/master/support/thread/${selectedThread.id}/messages`, { content });
      const msg = res?.data || res;
      setMessages((prev) => [...prev, msg]);
    } catch {
      toast.error('Failed to send message');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedThread || resolving) return;
    setResolving(true);
    try {
      await api.patch(`/master/support/thread/${selectedThread.id}/resolve`, {});
      setSelectedThread({ ...selectedThread, status: 'resolved' });
      setThreads((prev) =>
        prev.map((t) => t.id === selectedThread.id ? { ...t, status: 'resolved' } : t),
      );
      toast.success('Thread marked as resolved');
    } catch {
      toast.error('Failed to resolve thread');
    } finally {
      setResolving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredThreads = search
    ? threads.filter((t) =>
        t.company.name.toLowerCase().includes(search.toLowerCase()) ||
        t.company.domain.toLowerCase().includes(search.toLowerCase()),
      )
    : threads;

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100dvh-5.5rem)] overflow-hidden">
      <Card className="h-full shadow-sm overflow-hidden">
        <div className="flex h-full">
          {/* Thread List */}
          <div className={cn(
            'w-full md:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col',
            showMobileChat && 'hidden md:flex'
          )}>
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-slate-800 text-white">
              <h2 className="font-semibold text-sm text-amber-400">Platform Support Inbox</h2>
              <p className="text-xs text-slate-400 mt-0.5">Tenant admin support threads</p>
            </div>
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search companies..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No support threads yet</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isActive = selectedThread?.id === thread.id;
                  const lastMsg = thread.messages?.[0];
                  return (
                    <button
                      key={thread.id}
                      onClick={() => selectThread(thread)}
                      className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        isActive ? 'bg-slate-800/5 border-l-2 border-l-amber-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {thread.company.logo ? (
                          <img src={thread.company.logo} alt="" className="w-10 h-10 rounded-lg object-contain shrink-0 border" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">{thread.company.name}</p>
                            <Badge
                              variant={thread.status === 'resolved' ? 'secondary' : 'default'}
                              className="text-[9px] px-1.5 py-0 shrink-0"
                            >
                              {thread.status === 'resolved' ? 'Done' : 'Open'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {lastMsg?.content || 'No messages yet'}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(thread.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className={cn('flex-1 flex flex-col', !showMobileChat && 'hidden md:flex')}>
            {selectedThread ? (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0 bg-slate-800 text-white">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-white hover:bg-white/20"
                    onClick={() => { setShowMobileChat(false); setSelectedThread(null); }}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  {selectedThread.company.logo ? (
                    <img src={selectedThread.company.logo} alt="" className="w-9 h-9 rounded-lg object-contain border border-white/20" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedThread.company.name}</p>
                    <p className="text-xs text-white/60">{selectedThread.company.domain}</p>
                  </div>
                  {selectedThread.status !== 'resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white/10 hover:text-white text-xs h-7"
                      onClick={handleResolve}
                      disabled={resolving}
                    >
                      {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3 mr-1" />}
                      Resolve
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => {
                        const isOwn = msg.senderType === 'super_admin';
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                                isOwn
                                  ? 'bg-amber-500 text-white rounded-br-md'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                              }`}
                            >
                              {!isOwn && (
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                                  {msg.senderName}
                                </p>
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 shrink-0">
                  {selectedThread.status === 'resolved' ? (
                    <p className="text-xs text-center text-muted-foreground py-2">This thread is resolved.</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply to this company..."
                        className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/30 border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-medium">Select a support thread</p>
                <p className="text-sm mt-1">Choose a company's support request to respond</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
