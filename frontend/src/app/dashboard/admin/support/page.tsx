'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';

interface SupportThread {
  id: string;
  status: string;
  company: { id: string; name: string; logo?: string };
}

interface SupportMessage {
  id: string;
  content: string;
  senderType: string; // "company_admin" | "super_admin"
  senderId: string;
  senderName: string;
  createdAt: string;
}

export default function AdminSupportPage() {
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingThread, setLoadingThread] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getUser();
    if (user?.id) setCurrentUserId(user.id);
  }, []);

  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      const res: any = await api.get(`/master/support/thread/${threadId}/messages`);
      setMessages(Array.isArray(res) ? res : res?.data || res || []);
    } catch {
      // silent
    }
  }, []);

  // Load thread on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res: any = await api.get('/master/support/thread');
        const t: SupportThread = res?.data || res;
        setThread(t);
        await fetchMessages(t.id);
      } catch {
        toast.error('Failed to load support chat');
      } finally {
        setLoadingThread(false);
      }
    };
    init();
  }, [fetchMessages]);

  // Poll for new messages every 8s when tab is visible
  useEffect(() => {
    if (!thread) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      interval = setInterval(() => fetchMessages(thread.id), 8000);
    };

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchMessages(thread.id);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [thread, fetchMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !thread || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const res: any = await api.post(`/master/support/thread/${thread.id}/messages`, { content });
      const msg = res?.data || res;
      setMessages((prev) => [...prev, msg]);
    } catch {
      toast.error('Failed to send message');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loadingThread) {
    return (
      <div className="h-[calc(100dvh-5rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100dvh-5.5rem)] overflow-hidden">
      <Card className="h-full shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0 bg-slate-800 text-white">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">Livora OS Support</p>
            <p className="text-xs text-white/60">Technical support · Super Admin</p>
          </div>
          {thread && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              thread.status === 'resolved'
                ? 'bg-green-500/20 text-green-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {thread.status === 'resolved' ? 'Resolved' : 'Open'}
            </span>
          )}
        </div>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1 text-center max-w-xs">
                Send a message to Livora OS support. Our team will respond as soon as possible.
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.senderType === 'company_admin';
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-3.5 py-2 text-sm ${
                    isOwn
                      ? 'bg-slate-700 text-white rounded-br-md'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100 rounded-bl-md border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> {msg.senderName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your technical issue..."
              disabled={thread?.status === 'resolved'}
              className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400/30 border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending || thread?.status === 'resolved'}
              className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 transition-colors shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          {thread?.status === 'resolved' && (
            <p className="text-xs text-center text-muted-foreground mt-2">This support thread has been resolved.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
