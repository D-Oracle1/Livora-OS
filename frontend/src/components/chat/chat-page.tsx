'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  Video,
  Check,
  CheckCheck,
  Plus,
  ArrowLeft,
  Users,
  Loader2,
  X,
  Paperclip,
  FileText,
} from 'lucide-react';
import { VoiceRecorder } from './voice-recorder';
import { AudioPlayer } from './audio-player';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getImageUrl, api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { useChat, ChatRoom } from '@/contexts/chat-context';
import { useSocket } from '@/contexts/pusher-context';
import { useCall } from '@/contexts/call-context';

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?';
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface NewChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  GENERAL_OVERSEER: 'MD',
  ADMIN: 'Admin',
  STAFF: 'Staff',
  REALTOR: 'Realtor',
  CLIENT: 'Client',
};

export default function ChatPage() {
  const currentUser = getUser();
  const { rooms, activeRoom, messages, isLoadingRooms, isLoadingMessages, typingUsers, fetchRooms, selectRoom, sendMessage, sendVoiceMessage, createRoom, sendTyping, setActiveRoom } = useChat();
  const { onlineUsers } = useSocket();
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  let callCtx: ReturnType<typeof useCall> | null = null;
  try { callCtx = useCall(); } catch { /* CallProvider may not be mounted yet */ }

  // Fetch rooms when chat page mounts (lazy-loaded, not on app init)
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim() && attachmentUrls.length === 0) return;
    const msg = newMessage;
    const urls = attachmentUrls;
    setNewMessage('');
    setAttachmentUrls([]);
    sendTyping(false);
    try {
      const type = urls.length > 0 && !msg.trim() ? 'IMAGE' : 'TEXT';
      await sendMessage(msg, type, urls.length > 0 ? urls : undefined);
    } catch {
      setNewMessage(msg);
      setAttachmentUrls(urls);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setUploading(true);
    try {
      const uploaded = await api.uploadFiles('/upload/task-files', files);
      setAttachmentUrls((prev) => [...prev, ...uploaded]);
    } catch {
      // toast handled by api
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    sendTyping(true);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  const handleSelectRoom = (room: ChatRoom) => {
    selectRoom(room);
    setShowMobileChat(true);
  };

  const getOtherParticipant = (room: ChatRoom) => {
    if (room.type === 'DIRECT') {
      return room.participants.find(p => p.id !== currentUser?.id) || room.participants[0];
    }
    return null;
  };

  const getRoomName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (room.type === 'DIRECT') {
      const other = getOtherParticipant(room);
      return other ? `${other.firstName} ${other.lastName}` : 'Chat';
    }
    return room.participants.map(p => p.firstName).join(', ');
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.type === 'DIRECT') {
      const other = getOtherParticipant(room);
      return other;
    }
    return null;
  };

  const isOnline = (userId: string) => onlineUsers.includes(userId);

  const activeTypingUsers = typingUsers.filter(t => t.roomId === activeRoom?.id);

  // Load contacts when new chat panel opens
  const [allContacts, setAllContacts] = useState<NewChatUser[]>([]);
  const [groupedContacts, setGroupedContacts] = useState<Record<string, NewChatUser[]>>({});
  const [loadingContacts, setLoadingContacts] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await api.get<any>('/chat/contacts');
      const data = res?.data ?? res;
      const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
      const grouped = data?.grouped || {};
      setAllContacts(contacts.filter((u: any) => u.id !== currentUser?.id));
      setGroupedContacts(grouped);
    } catch {
      setAllContacts([]);
      setGroupedContacts({});
    } finally {
      setLoadingContacts(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (showNewChat && allContacts.length === 0) {
      loadContacts();
    }
  }, [showNewChat, loadContacts, allContacts.length]);

  // Client-side filter of contacts
  const filteredContacts = newChatSearch.trim()
    ? allContacts.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(newChatSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(newChatSearch.toLowerCase())
      )
    : allContacts;

  // Group filtered contacts by role
  const filteredGrouped: Record<string, NewChatUser[]> = {};
  for (const user of filteredContacts) {
    if (!filteredGrouped[user.role]) filteredGrouped[user.role] = [];
    filteredGrouped[user.role].push(user);
  }

  const startNewChat = async (user: NewChatUser) => {
    try {
      const room = await createRoom([user.id]);
      setShowNewChat(false);
      setNewChatSearch('');
      setAllContacts([]);
      selectRoom(room);
      setShowMobileChat(true);
    } catch {
      // error
    }
  };

  const handleCall = (type: 'audio' | 'video') => {
    if (!activeRoom || !callCtx) return;
    const other = getOtherParticipant(activeRoom);
    if (other) {
      callCtx.initiateCall(other.id, type, `${other.firstName} ${other.lastName}`, other.avatar || undefined);
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true;
    const name = getRoomName(room).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100dvh-5rem)] md:h-[calc(100dvh-5.5rem)] overflow-hidden">
      <Card className="h-full overflow-hidden flex flex-col">
        <div className="flex flex-1 min-h-0">
            {/* Conversations List */}
            <div className={cn(
              'w-full md:w-80 border-r flex flex-col min-h-0',
              showMobileChat && 'hidden md:flex'
            )}>
              <div className="p-4 border-b space-y-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button size="icon" variant="outline" onClick={() => setShowNewChat(true)} title="New conversation">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* New chat modal */}
              <AnimatePresence>
                {showNewChat && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b overflow-hidden"
                  >
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">New Conversation</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowNewChat(false); setNewChatSearch(''); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Search by name..."
                        value={newChatSearch}
                        onChange={(e) => setNewChatSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="max-h-64 overflow-y-auto">
                        {loadingContacts && (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {!loadingContacts && Object.entries(filteredGrouped).map(([role, users]) => (
                          <div key={role}>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
                              {ROLE_LABELS[role] || role}
                            </p>
                            {users.map(user => (
                              <button
                                key={user.id}
                                onClick={() => startNewChat(user)}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                              >
                                <div className="relative">
                                  <Avatar className="h-8 w-8">
                                    {user.avatar && <AvatarImage src={getImageUrl(user.avatar)} />}
                                    <AvatarFallback className="bg-primary text-white text-xs">
                                      {getInitials(user.firstName, user.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {isOnline(user.id) && (
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                        {!loadingContacts && filteredContacts.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">
                            {newChatSearch ? 'No users found' : 'No contacts available'}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoadingRooms ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start a new conversation using the + button</p>
                  </div>
                ) : (
                  filteredRooms.map((room) => {
                    const avatarUser = getRoomAvatar(room);
                    const roomOnline = room.type === 'DIRECT' && avatarUser ? isOnline(avatarUser.id) : false;

                    return (
                      <div
                        key={room.id}
                        onClick={() => handleSelectRoom(room)}
                        className={cn(
                          'flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                          activeRoom?.id === room.id && 'bg-primary/5'
                        )}
                      >
                        <div className="relative">
                          <Avatar>
                            {avatarUser?.avatar && <AvatarImage src={getImageUrl(avatarUser.avatar)} />}
                            <AvatarFallback className="bg-primary text-white">
                              {room.type === 'GROUP' ? (
                                <Users className="w-4 h-4" />
                              ) : (
                                getInitials(avatarUser?.firstName, avatarUser?.lastName)
                              )}
                            </AvatarFallback>
                          </Avatar>
                          {roomOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate text-sm">{getRoomName(room)}</p>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                              {timeAgo(room.lastMessage?.createdAt || room.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground truncate">
                              {room.lastMessage?.content || 'No messages yet'}
                            </p>
                            {room.unreadCount > 0 && (
                              <Badge className="ml-2 bg-primary shrink-0">{room.unreadCount}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
              'flex-1 flex flex-col min-h-0',
              !showMobileChat && 'hidden md:flex'
            )}>
              {activeRoom ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => { setShowMobileChat(false); setActiveRoom(null); }}
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <Avatar>
                        {getRoomAvatar(activeRoom)?.avatar && (
                          <AvatarImage src={getImageUrl(getRoomAvatar(activeRoom)!.avatar!)} />
                        )}
                        <AvatarFallback className="bg-primary text-white">
                          {activeRoom.type === 'GROUP' ? (
                            <Users className="w-4 h-4" />
                          ) : (
                            getInitials(getRoomAvatar(activeRoom)?.firstName, getRoomAvatar(activeRoom)?.lastName)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getRoomName(activeRoom)}</p>
                        <p className="text-sm text-muted-foreground">
                          {activeRoom.type === 'DIRECT' && getRoomAvatar(activeRoom)
                            ? isOnline(getRoomAvatar(activeRoom)!.id) ? 'Online' : 'Offline'
                            : `${activeRoom.participants.length} members`}
                          {activeTypingUsers.length > 0 && ' • typing...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeRoom.type === 'DIRECT' && (() => {
                        const isCalling = callCtx?.callStatus !== 'idle';
                        return (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCall('audio')}
                              title={isCalling ? 'Call in progress' : 'Voice call'}
                              disabled={isCalling}
                              className={isCalling ? 'text-amber-500 animate-pulse' : ''}
                            >
                              <Phone className="w-5 h-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCall('video')}
                              title={isCalling ? 'Call in progress' : 'Video call'}
                              disabled={isCalling}
                              className={isCalling ? 'text-amber-500 animate-pulse' : ''}
                            >
                              <Video className="w-5 h-5" />
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isMe = message.senderId === currentUser?.id;
                        const isRead = message.readBy && message.readBy.length > 1;
                        return (
                          <div
                            key={message.id}
                            className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                          >
                            {!isMe && activeRoom.type === 'GROUP' && (
                              <Avatar className="h-8 w-8 mr-2 mt-1 shrink-0">
                                {message.sender?.avatar && <AvatarImage src={getImageUrl(message.sender.avatar)} />}
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                  {getInitials(message.sender?.firstName, message.sender?.lastName)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              'max-w-[75%] rounded-2xl px-3.5 py-2',
                              isMe
                                ? 'bg-primary text-white rounded-br-md'
                                : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md'
                            )}>
                              {!isMe && activeRoom.type === 'GROUP' && (
                                <p className="text-xs font-medium mb-0.5 text-primary dark:text-primary/80">
                                  {message.sender?.firstName} {message.sender?.lastName}
                                </p>
                              )}
                              {/* Voice message */}
                              {message.type === 'VOICE' && message.voiceMessage ? (
                                <AudioPlayer
                                  audioUrl={message.voiceMessage.audioUrl}
                                  duration={message.voiceMessage.duration}
                                  waveform={message.voiceMessage.waveform}
                                  isMe={isMe}
                                />
                              ) : message.content && (
                                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                              )}
                              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {(message.attachments as string[]).map((url, i) => {
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
                                    return isImage ? (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={url}
                                          alt="attachment"
                                          className="max-w-[220px] rounded-lg mt-1 cursor-pointer hover:opacity-90"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          'flex items-center gap-1.5 text-xs underline',
                                          isMe ? 'text-white/80' : 'text-blue-600',
                                        )}
                                      >
                                        <FileText className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate max-w-[180px]">{url.split('/').pop()}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                              <div className={cn('flex items-center gap-1 mt-0.5', isMe ? 'justify-end' : 'justify-start')}>
                                <span className={cn('text-[10px]', isMe ? 'text-white/60' : 'text-muted-foreground')}>
                                  {formatMessageTime(message.createdAt)}
                                </span>
                                {isMe && (
                                  isRead
                                    ? <CheckCheck className="w-3.5 h-3.5 text-white/60" />
                                    : <Check className="w-3.5 h-3.5 text-white/60" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Typing indicator */}
                  {activeTypingUsers.length > 0 && (
                    <div className="px-4 pb-1 shrink-0">
                      <p className="text-xs text-muted-foreground animate-pulse">
                        Someone is typing...
                      </p>
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="p-3 border-t shrink-0">
                    {/* Attachment previews */}
                    {attachmentUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {attachmentUrls.map((url, i) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
                          return (
                            <div key={i} className="relative group">
                              {isImage ? (
                                <img src={url} alt="preview" className="w-14 h-14 rounded-lg object-cover border" />
                              ) : (
                                <div className="w-14 h-14 rounded-lg border flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <button
                                onClick={() => setAttachmentUrls((prev) => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.xlsx,.csv"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-40"
                        title="Attach file"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      </button>
                      {/* Voice recorder — expands to replace input while recording */}
                      <VoiceRecorder
                        onSend={sendVoiceMessage}
                        disabled={!!newMessage.trim() || attachmentUrls.length > 0}
                      />
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                      />
                      {(newMessage.trim() || attachmentUrls.length > 0) && (
                        <button
                          onClick={handleSend}
                          disabled={!newMessage.trim() && attachmentUrls.length === 0}
                          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
                    <p className="text-sm text-muted-foreground mt-1">Choose from your existing conversations or start a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
    </div>
  );
}
