'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Save,
  Globe,
  MapPin,
  Star,
  Users,
  BarChart2,
  QrCode,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import Link from 'next/link';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File Upload' },
];

interface FormFieldDraft {
  _id: string;
  id?: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  options: string;
  orderIndex: number;
}

interface EventDetail {
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
  status: 'draft' | 'published' | 'closed';
  isFeatured: boolean;
  formFields: Array<{
    id: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    options: string[] | null;
    orderIndex: number;
  }>;
  _count: { registrations: number };
  analytics: {
    viewsCount: number;
    registrationsCount: number;
    checkinsCount: number;
    conversionRate: number;
  } | null;
}

function toLocalDatetimeInput(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id || '';

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Controlled fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [locationType, setLocationType] = useState<'physical' | 'online'>('physical');
  const [locationDetails, setLocationDetails] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [formFields, setFormFields] = useState<FormFieldDraft[]>([]);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: EventDetail }>(`/events/${id}`);
      const ev = res.data;
      setEvent(ev);
      setTitle(ev.title);
      setDescription(ev.description || '');
      setBannerUrl(ev.bannerUrl || '');
      setLocationType(ev.locationType);
      setLocationDetails(ev.locationDetails || '');
      setEventDate(toLocalDatetimeInput(ev.eventDate));
      setRegistrationDeadline(toLocalDatetimeInput(ev.registrationDeadline));
      setMaxAttendees(ev.maxAttendees ? String(ev.maxAttendees) : '');
      setIsFeatured(ev.isFeatured);
      setFormFields(
        ev.formFields.map((f) => ({
          _id: f.id,
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: Array.isArray(f.options) ? f.options.join('\n') : '',
          orderIndex: f.orderIndex,
        })),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  function addField() {
    setFormFields((prev) => [
      ...prev,
      {
        _id: `new-${Date.now()}`,
        label: '',
        fieldType: 'text',
        isRequired: false,
        options: '',
        orderIndex: prev.length,
      },
    ]);
  }

  function removeField(fid: string) {
    setFormFields((prev) => prev.filter((f) => f._id !== fid));
  }

  function updateField(fid: string, key: keyof FormFieldDraft, value: unknown) {
    setFormFields((prev) =>
      prev.map((f) => (f._id === fid ? { ...f, [key]: value } : f)),
    );
  }

  function moveField(index: number, direction: 'up' | 'down') {
    setFormFields((prev) => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr.map((f, i) => ({ ...f, orderIndex: i }));
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!eventDate) { toast.error('Event date is required'); return; }

    const eventDateObj = new Date(eventDate);
    if (registrationDeadline && new Date(registrationDeadline) >= eventDateObj) {
      toast.error('Registration deadline must be before event date');
      return;
    }

    for (const f of formFields) {
      if (!f.label.trim()) { toast.error('All fields must have a label'); return; }
      if (f.fieldType === 'dropdown' && !f.options.trim()) {
        toast.error(`Dropdown "${f.label}" must have options`);
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/events/${id}`, {
        title: title.trim(),
        description: description.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        locationType,
        locationDetails: locationDetails.trim() || undefined,
        eventDate: new Date(eventDate).toISOString(),
        registrationDeadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
        isFeatured,
        formFields: formFields.map((f, i) => ({
          label: f.label.trim(),
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options:
            f.fieldType === 'dropdown'
              ? f.options.split('\n').map((o) => o.trim()).filter(Boolean)
              : undefined,
          orderIndex: i,
        })),
      });
      toast.success('Event updated');
      fetchEvent();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!event) return null;

  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-green-100 text-green-700',
    closed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/events">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status]}`}>
                {event.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">/{event.slug}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/dashboard/admin/events/${id}/registrations`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />
              {event._count.registrations} Registrations
            </Button>
          </Link>
          <Link href={`/dashboard/admin/events/${id}/checkin`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <QrCode className="w-3.5 h-3.5" />
              Check-in
            </Button>
          </Link>
        </div>
      </div>

      {/* Analytics strip */}
      {event.analytics && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Views', value: event.analytics.viewsCount },
            { label: 'Registrations', value: event.analytics.registrationsCount },
            { label: 'Check-ins', value: event.analytics.checkinsCount },
            { label: 'Conversion', value: `${Number(event.analytics.conversionRate).toFixed(1)}%` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Banner Image URL</Label>
              <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="featured-edit" checked={isFeatured} onCheckedChange={setIsFeatured} />
              <Label htmlFor="featured-edit" className="cursor-pointer flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400" /> Feature on homepage
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Event Date & Time <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Registration Deadline</Label>
                <Input
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Location Type <span className="text-red-500">*</span></Label>
                <Select value={locationType} onValueChange={(v) => setLocationType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical"><span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Physical</span></SelectItem>
                    <SelectItem value="online"><span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Online</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Max Attendees</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type="number" placeholder="Unlimited" className="pl-9" min={1} value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{locationType === 'online' ? 'Meeting Link' : 'Venue Address'}</Label>
              <Input value={locationDetails} onChange={(e) => setLocationDetails(e.target.value)} maxLength={500} />
            </div>
          </CardContent>
        </Card>

        {/* Form Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Registration Form</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1">
                <Plus className="w-4 h-4" /> Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formFields.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed rounded-lg">
                No fields. Click "Add Field" to add registration form inputs.
              </div>
            ) : (
              formFields.map((field, index) => (
                <motion.div
                  key={field._id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border rounded-lg p-4 space-y-3 bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-300" />
                    <span className="text-xs font-medium text-gray-500 flex-1">Field {index + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, 'up')} disabled={index === 0}><ChevronUp className="w-3 h-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(index, 'down')} disabled={index === formFields.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => removeField(field._id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label *</Label>
                      <Input placeholder="e.g. Full Name" value={field.label} onChange={(e) => updateField(field._id, 'label', e.target.value)} maxLength={200} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Field Type</Label>
                      <Select value={field.fieldType} onValueChange={(v) => updateField(field._id, 'fieldType', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {field.fieldType === 'dropdown' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (one per line) *</Label>
                      <Textarea placeholder="Option 1&#10;Option 2&#10;Option 3" rows={3} value={field.options} onChange={(e) => updateField(field._id, 'options', e.target.value)} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox id={`req-${field._id}`} checked={field.isRequired} onCheckedChange={(v) => updateField(field._id, 'isRequired', Boolean(v))} />
                    <Label htmlFor={`req-${field._id}`} className="text-xs cursor-pointer">Required field</Label>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/admin/events">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2 min-w-32">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
