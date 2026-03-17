'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ArrowLeft,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  label: string;
  fieldType: string;
  isRequired: boolean;
  options: string;
  orderIndex: number;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Core event fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [locationType, setLocationType] = useState<'physical' | 'online'>('physical');
  const [locationDetails, setLocationDetails] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Form builder
  const [formFields, setFormFields] = useState<FormFieldDraft[]>([]);

  function addField() {
    setFormFields((prev) => [
      ...prev,
      {
        _id: `field-${Date.now()}`,
        label: '',
        fieldType: 'text',
        isRequired: false,
        options: '',
        orderIndex: prev.length,
      },
    ]);
  }

  function removeField(id: string) {
    setFormFields((prev) => prev.filter((f) => f._id !== id));
  }

  function updateField(id: string, key: keyof FormFieldDraft, value: unknown) {
    setFormFields((prev) =>
      prev.map((f) => (f._id === id ? { ...f, [key]: value } : f)),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!eventDate) { toast.error('Event date is required'); return; }
    if (!locationType) { toast.error('Location type is required'); return; }

    const eventDateObj = new Date(eventDate);
    if (eventDateObj <= new Date()) { toast.error('Event date must be in the future'); return; }

    if (registrationDeadline) {
      if (new Date(registrationDeadline) >= eventDateObj) {
        toast.error('Registration deadline must be before the event date');
        return;
      }
    }

    // Validate form fields
    for (const f of formFields) {
      if (!f.label.trim()) { toast.error('All form fields must have a label'); return; }
      if (f.fieldType === 'dropdown' && !f.options.trim()) {
        toast.error(`Dropdown field "${f.label}" must have options`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        locationType,
        locationDetails: locationDetails.trim() || undefined,
        eventDate: eventDateObj.toISOString(),
        registrationDeadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : undefined,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        isFeatured,
        formFields: formFields.map((f, i) => ({
          label: f.label.trim(),
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: f.fieldType === 'dropdown'
            ? f.options.split('\n').map((o) => o.trim()).filter(Boolean)
            : undefined,
          orderIndex: i,
        })),
      };

      await api.post('/events', payload);
      toast.success('Event created successfully');
      router.push('/dashboard/admin/events');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/events">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
          <p className="text-sm text-gray-500">Set up a new event with a custom registration form</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Annual Real Estate Summit 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the event, agenda, speakers..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Banner Image URL</Label>
              <Input
                placeholder="https://..."
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="featured"
                checked={isFeatured}
                onCheckedChange={setIsFeatured}
              />
              <Label htmlFor="featured" className="cursor-pointer flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400" />
                Feature on homepage
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Date & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Event Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
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
                <Label>
                  Location Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={locationType}
                  onValueChange={(v) => setLocationType(v as 'physical' | 'online')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Physical
                      </span>
                    </SelectItem>
                    <SelectItem value="online">
                      <span className="flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Online
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Max Attendees</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    className="pl-9"
                    min={1}
                    value={maxAttendees}
                    onChange={(e) => setMaxAttendees(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>
                {locationType === 'online' ? 'Meeting Link / Platform' : 'Venue Address'}
              </Label>
              <Input
                placeholder={
                  locationType === 'online'
                    ? 'https://zoom.us/j/...'
                    : '123 Main St, City, State'
                }
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Registration Form</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1">
                <Plus className="w-4 h-4" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formFields.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed rounded-lg">
                No fields yet. Click "Add Field" to build your registration form.
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
                    <span className="text-xs font-medium text-gray-500 flex-1">
                      Field {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, 'down')}
                      disabled={index === formFields.length - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:bg-red-50"
                      onClick={() => removeField(field._id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label *</Label>
                      <Input
                        placeholder="e.g. Full Name"
                        value={field.label}
                        onChange={(e) => updateField(field._id, 'label', e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Field Type</Label>
                      <Select
                        value={field.fieldType}
                        onValueChange={(v) => updateField(field._id, 'fieldType', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {field.fieldType === 'dropdown' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (one per line) *</Label>
                      <Textarea
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        rows={3}
                        value={field.options}
                        onChange={(e) => updateField(field._id, 'options', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`req-${field._id}`}
                      checked={field.isRequired}
                      onCheckedChange={(v) => updateField(field._id, 'isRequired', Boolean(v))}
                    />
                    <Label htmlFor={`req-${field._id}`} className="text-xs cursor-pointer">
                      Required field
                    </Label>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/admin/events">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting} className="gap-2 min-w-36">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
