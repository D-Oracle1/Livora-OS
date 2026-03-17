'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Clock,
  Share2,
  CheckCircle2,
  XCircle,
  Loader2,
  QrCode,
  Copy,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || null;

function buildHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(COMPANY_ID ? { 'X-Company-ID': COMPANY_ID } : {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers: { ...buildHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ── COUNTDOWN HOOK ──────────────────────────────────────────────────────────

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

// ── TYPES ───────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  label: string;
  fieldType: 'text' | 'email' | 'phone' | 'dropdown' | 'checkbox' | 'file';
  isRequired: boolean;
  options: string[] | null;
  orderIndex: number;
}

interface EventData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  locationType: 'physical' | 'online';
  locationDetails: string | null;
  eventDate: string;
  registrationDeadline: string | null;
  maxAttendees: number | null;
  status: 'published' | 'closed';
  isFeatured: boolean;
  formFields: FormField[];
  _count: { registrations: number };
}

// ── DYNAMIC FORM RENDERER ────────────────────────────────────────────────────

function DynamicFormField({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const baseClass = 'w-full';
  const errClass = error ? 'border-red-500 focus-visible:ring-red-500' : '';

  switch (field.fieldType) {
    case 'dropdown':
      return (
        <Select value={String(value || '')} onValueChange={onChange}>
          <SelectTrigger className={errClass}>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            className={error ? 'border-red-500' : ''}
          />
          <label htmlFor={field.id} className="text-sm cursor-pointer">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
      );

    case 'file':
      return (
        <Input
          type="file"
          className={`${baseClass} ${errClass} cursor-pointer`}
          onChange={(e) => onChange(e.target.files?.[0]?.name || '')}
        />
      );

    case 'email':
      return (
        <Input
          type="email"
          placeholder={`Enter your ${field.label}`}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} ${errClass}`}
          autoComplete="email"
        />
      );

    case 'phone':
      return (
        <Input
          type="tel"
          placeholder={`Enter your ${field.label}`}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} ${errClass}`}
          autoComplete="tel"
        />
      );

    default:
      return (
        <Input
          type="text"
          placeholder={`Enter ${field.label}`}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} ${errClass}`}
        />
      );
  }
}

// ── COUNTDOWN BLOCK ──────────────────────────────────────────────────────────

function CountdownBlock({ eventDate }: { eventDate: string }) {
  const { days, hours, minutes, seconds } = useCountdown(eventDate);
  const isPast = new Date(eventDate) <= new Date();
  if (isPast) return null;

  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      {[
        { label: 'Days', val: days },
        { label: 'Hours', val: hours },
        { label: 'Minutes', val: minutes },
        { label: 'Seconds', val: seconds },
      ].map(({ label, val }) => (
        <div
          key={label}
          className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20"
        >
          <div className="text-3xl font-bold tabular-nums">{String(val).padStart(2, '0')}</div>
          <div className="text-xs text-gray-300 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PublicEventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState<{
    registrationCode: string;
    qrCode: string;
  } | null>(null);

  const isFull =
    event?.maxAttendees !== null &&
    event?._count.registrations !== undefined &&
    event._count.registrations >= (event.maxAttendees ?? Infinity);

  const deadlinePassed =
    event?.registrationDeadline !== null &&
    event?.registrationDeadline !== undefined &&
    new Date() > new Date(event.registrationDeadline);

  const registrationClosed =
    event?.status === 'closed' || isFull || deadlinePassed;

  // ── Fetch event ──────────────────────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: EventData }>(`/events/public/${slug}`);
      setEvent(res.data);
    } catch (err: any) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // ── Validate ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    if (!event) return false;
    const errors: Record<string, string> = {};
    for (const field of event.formFields) {
      const val = formValues[field.label];
      if (field.isRequired && (val === undefined || val === null || val === '' || val === false)) {
        errors[field.label] = `${field.label} is required`;
      } else if (field.fieldType === 'email' && val) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val));
        if (!ok) errors[field.label] = 'Enter a valid email address';
      } else if (field.fieldType === 'phone' && val) {
        const ok = /^[+\d\s\-().]{7,20}$/.test(String(val));
        if (!ok) errors[field.label] = 'Enter a valid phone number';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !validate()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: { registrationCode: string; qrCode: string } }>(
        `/events/public/${event.id}/register`,
        {
          method: 'POST',
          body: JSON.stringify({ userData: formValues }),
        },
      );
      setRegistered({ registrationCode: res.data.registrationCode, qrCode: res.data.qrCode });
      toast.success('Registration successful!');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  }

  // ── RENDER STATES ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <XCircle className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-700">Event Not Found</h1>
        <p className="text-gray-500 text-center">
          This event doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  // ── SUCCESS STATE ─────────────────────────────────────────────────────────

  if (registered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-gradient-to-b from-green-50 to-white">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <CheckCircle2 className="w-20 h-20 text-green-500" />
          <h1 className="text-3xl font-bold text-gray-800">You're Registered!</h1>
          <p className="text-gray-500 max-w-md">
            Save your QR code — you'll need it to check in at the event.
          </p>

          <div className="bg-white rounded-2xl p-6 shadow-lg border flex flex-col items-center gap-3">
            <Badge variant="outline" className="font-mono text-sm px-4 py-1">
              {registered.registrationCode}
            </Badge>
            {registered.qrCode && (
              <img
                src={registered.qrCode}
                alt="Registration QR Code"
                className="w-56 h-56 rounded-lg border"
              />
            )}
            <p className="text-xs text-gray-400">Screenshot or print this QR code</p>
          </div>

          <Button
            variant="outline"
            onClick={() => window.location.href = `/event/${slug}`}
          >
            Back to Event
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── MAIN RENDER ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero / Banner */}
      <div
        className="relative w-full h-72 sm:h-96 bg-gradient-to-br from-blue-900 to-indigo-700 flex flex-col justify-end"
        style={
          event.bannerUrl
            ? { backgroundImage: `url(${event.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}
        }
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 px-6 pb-8 text-white max-w-4xl mx-auto w-full">
          <div className="flex flex-wrap gap-2 mb-3">
            {event.isFeatured && (
              <Badge className="bg-yellow-400 text-yellow-900 border-0">Featured</Badge>
            )}
            <Badge
              className={
                event.status === 'published' && !registrationClosed
                  ? 'bg-green-500 text-white border-0'
                  : 'bg-gray-500 text-white border-0'
              }
            >
              {registrationClosed ? 'Registration Closed' : 'Registration Open'}
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{event.title}</h1>

          <div className="mt-4">
            <CountdownBlock eventDate={event.eventDate} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left — Details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Meta info */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900">
                    {new Date(event.eventDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-xs">
                    {new Date(event.eventDate).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {event.locationDetails && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  {event.locationType === 'online' ? (
                    <Globe className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}
                  <span>{event.locationDetails}</span>
                </div>
              )}

              {event.maxAttendees && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span>
                    {event._count.registrations} / {event.maxAttendees} registered
                  </span>
                </div>
              )}

              {event.registrationDeadline && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <span>
                    Registration closes{' '}
                    {new Date(event.registrationDeadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {event.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About this Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Share */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share Event
            </Button>
          </div>
        </div>

        {/* Right — Registration Form */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">
                {registrationClosed ? 'Registration Status' : 'Register Now'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Closed states */}
              {event.status === 'closed' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <XCircle className="w-10 h-10 text-gray-400" />
                  <p className="text-gray-500 text-sm">
                    Registration for this event is now closed.
                  </p>
                </div>
              )}

              {event.status === 'published' && isFull && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <AlertCircle className="w-10 h-10 text-orange-400" />
                  <p className="text-orange-600 text-sm font-medium">
                    This event is fully booked.
                  </p>
                </div>
              )}

              {event.status === 'published' && !isFull && deadlinePassed && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Clock className="w-10 h-10 text-gray-400" />
                  <p className="text-gray-500 text-sm">
                    The registration deadline has passed.
                  </p>
                </div>
              )}

              {/* Registration form */}
              {event.status === 'published' && !registrationClosed && (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {event.formFields.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No information required — just click to register!
                    </p>
                  ) : (
                    event.formFields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        {field.fieldType !== 'checkbox' && (
                          <Label htmlFor={field.id} className="text-sm font-medium">
                            {field.label}
                            {field.isRequired && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </Label>
                        )}
                        <DynamicFormField
                          field={field}
                          value={formValues[field.label] ?? ''}
                          onChange={(v) =>
                            setFormValues((prev) => ({ ...prev, [field.label]: v }))
                          }
                          error={formErrors[field.label]}
                        />
                        {formErrors[field.label] && (
                          <p className="text-xs text-red-500">{formErrors[field.label]}</p>
                        )}
                      </div>
                    ))
                  )}

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering…
                      </>
                    ) : (
                      <>
                        Register
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
