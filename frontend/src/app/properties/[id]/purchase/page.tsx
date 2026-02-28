'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  CopyCheck,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getToken, getUser } from '@/lib/auth-storage';
import { api } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

function formatPrice(price: number): string {
  if (price >= 1_000_000_000) return `₦${(price / 1_000_000_000).toFixed(2)}B`;
  if (price >= 1_000_000) return `₦${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `₦${(price / 1_000).toFixed(0)}K`;
  return `₦${price.toLocaleString()}`;
}

export default function PurchasePage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const branding = useBranding();
  const companyName = getCompanyName(branding);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [property, setProperty] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [enquiryId, setEnquiryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(true);

  const user = getUser();

  const [form, setForm] = useState({
    fullName: (user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : ''),
    phone: (user as any)?.phone || '',
    email: (user as any)?.email || '',
    numPlots: 1,
    nin: '',
    address: '',
    nextOfKin: '',
    occupation: '',
    message: '',
  });

  // Auth guard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(`/properties/${propertyId}/purchase`)}`);
    }
  }, [propertyId, router]);

  // Fetch property details
  useEffect(() => {
    if (!propertyId) return;
    api.get(`/properties/listed/${propertyId}`)
      .then((res) => {
        const data = res?.data || res;
        setProperty(data);
      })
      .catch(() => {})
      .finally(() => setLoadingProperty(false));
  }, [propertyId]);

  // Fetch CMS payment info
  useEffect(() => {
    api.get('/cms/public/payment')
      .then((res) => {
        const data = res?.data || res;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setPaymentInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleFormChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, propertyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      const id = data?.data?.id || data?.id;
      setEnquiryId(id);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentConfirm = async () => {
    setConfirming(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/purchases/${enquiryId}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to confirm');
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setConfirming(false);
    }
  };

  const totalAmount =
    property && form.numPlots
      ? property.pricePerSqm
        ? Number(property.pricePerSqm) * form.numPlots
        : Number(property.price)
      : null;

  if (loadingProperty) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <Building2 className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Property not found.</p>
        <Link href="/properties"><Button variant="outline">Back to Properties</Button></Link>
      </div>
    );
  }

  const stepLabels = ['Purchase Form', 'Payment Details', 'Confirmation'];

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-primary-950">
      {/* Header */}
      <div className="bg-white dark:bg-primary-900 border-b border-gray-200 dark:border-primary-800">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/properties/${propertyId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div>
            <p className="text-xs text-gray-500">Purchasing</p>
            <h1 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{property.title}</h1>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white dark:bg-primary-900 border-b border-gray-200 dark:border-primary-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 max-w-lg">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : n}
                  </div>
                  <span className={`text-xs hidden sm:block ${active ? 'text-accent font-medium' : 'text-gray-400'}`}>{label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-gray-200 dark:bg-primary-700 mx-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* ── STEP 1: Purchase Form ── */}
        {step === 1 && (
          <div className="bg-white dark:bg-primary-900 rounded-2xl shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Your Details</h2>
            <p className="text-sm text-gray-500 mb-6">Fill in your information to proceed with the purchase of <strong>{property.title}</strong>.</p>

            {/* Property summary */}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-6 flex items-start gap-3">
              <Landmark className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{property.title}</p>
                <p className="text-xs text-gray-500">{property.city}, {property.state}</p>
                {property.pricePerSqm && (
                  <p className="text-xs text-accent font-medium mt-1">{formatPrice(Number(property.pricePerSqm))} / plot</p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Full Name *</label>
                  <Input
                    required
                    placeholder="John Doe"
                    value={form.fullName}
                    onChange={(e) => handleFormChange('fullName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Phone Number *</label>
                  <Input
                    required
                    placeholder="+2348012345678"
                    value={form.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Email Address *</label>
                  <Input
                    required
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Number of Plots *</label>
                  <Input
                    required
                    type="number"
                    min={1}
                    value={form.numPlots}
                    onChange={(e) => handleFormChange('numPlots', Math.max(1, Number(e.target.value)))}
                  />
                  {totalAmount !== null && (
                    <p className="text-xs text-accent font-medium mt-1">Total: {formatPrice(totalAmount)}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">NIN (optional)</label>
                <Input
                  placeholder="National Identification Number"
                  value={form.nin}
                  onChange={(e) => handleFormChange('nin', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Residential Address *</label>
                <Input
                  required
                  placeholder="12 Palm Avenue, Ikeja, Lagos"
                  value={form.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Next of Kin *</label>
                  <Input
                    required
                    placeholder="Name & phone number"
                    value={form.nextOfKin}
                    onChange={(e) => handleFormChange('nextOfKin', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Occupation *</label>
                  <Input
                    required
                    placeholder="e.g. Engineer"
                    value={form.occupation}
                    onChange={(e) => handleFormChange('occupation', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Message (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Any additional information or questions…"
                  value={form.message}
                  onChange={(e) => handleFormChange('message', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent-600 text-white py-6 text-base"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Continue to Payment Details
              </Button>
            </form>
          </div>
        )}

        {/* ── STEP 2: Payment Details ── */}
        {step === 2 && (
          <div className="bg-white dark:bg-primary-900 rounded-2xl shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Payment Details</h2>
            <p className="text-sm text-gray-500 mb-6">
              Transfer the payment to the account below, then click <strong>"I Have Made Payment"</strong>.
            </p>

            {/* Amount summary */}
            {totalAmount !== null && (
              <div className="bg-accent/10 rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-gray-500">Total Amount Due</p>
                <p className="text-3xl font-bold text-accent">{formatPrice(totalAmount)}</p>
                <p className="text-xs text-gray-400 mt-1">{form.numPlots} plot{form.numPlots > 1 ? 's' : ''} × {property.pricePerSqm ? formatPrice(Number(property.pricePerSqm)) : formatPrice(Number(property.price))}</p>
              </div>
            )}

            {/* Bank details */}
            {paymentInfo ? (
              <div className="border border-gray-200 dark:border-primary-700 rounded-xl divide-y divide-gray-100 dark:divide-primary-700 mb-6">
                {paymentInfo.bankName && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-500">Bank</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{paymentInfo.bankName}</span>
                  </div>
                )}
                {paymentInfo.accountName && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-500">Account Name</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{paymentInfo.accountName}</span>
                  </div>
                )}
                {paymentInfo.accountNumber && (
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-500">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white tracking-wider">{paymentInfo.accountNumber}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentInfo.accountNumber);
                          toast.success('Account number copied!');
                        }}
                        className="text-accent hover:text-accent-600"
                        title="Copy"
                      >
                        <CopyCheck className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {paymentInfo.bankBranch && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-500">Branch</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{paymentInfo.bankBranch}</span>
                  </div>
                )}
                {paymentInfo.additionalInfo && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-500 mb-1">Additional Instructions</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{paymentInfo.additionalInfo}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 mb-6 text-center text-sm text-yellow-700">
                Payment details not yet configured. Please contact us directly.
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mb-4">
              Use <strong>{property.title}</strong> as your payment reference/narration.
            </p>

            <Button
              onClick={handlePaymentConfirm}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-base"
              disabled={confirming}
            >
              {confirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              I Have Made Payment
            </Button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-3 w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              Go back and edit details
            </button>
          </div>
        )}

        {/* ── STEP 3: Confirmation ── */}
        {step === 3 && (
          <div className="bg-white dark:bg-primary-900 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Received!</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              Thank you, <strong>{form.fullName}</strong>. Our team has been notified and will confirm your purchase within <strong>24–48 hours</strong>.
              You'll receive a follow-up via email or phone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/properties">
                <Button variant="outline">Browse More Properties</Button>
              </Link>
              <Link href="/dashboard/client">
                <Button className="bg-accent hover:bg-accent-600 text-white">Go to My Dashboard</Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
