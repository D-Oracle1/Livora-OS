'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { setAuth, clearAuth, getToken, getUser } from '@/lib/auth-storage';
import { getImageUrl, setTenantId } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const oauthError = searchParams.get('error');
  const branding = useBranding();
  const companyName = getCompanyName(branding);

  // Show toast for OAuth errors redirected from backend
  useEffect(() => {
    if (!oauthError) return;
    if (oauthError === 'oauth_not_configured') {
      toast.error('Social sign-in is not configured yet. Please use email & password.');
    } else if (oauthError === 'oauth_failed' || oauthError === 'oauth_error') {
      toast.error('Social sign-in failed. Please try again or use email & password.');
    }
  }, [oauthError]);

  // If already authenticated, redirect to the appropriate dashboard immediately
  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      const role = (user as any).role?.toLowerCase();
      if ((user as any).isSuperAdmin || role === 'super_admin') {
        router.replace('/dashboard/super-admin');
      } else if (role === 'general_overseer') {
        router.replace('/dashboard/general-overseer');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else if (role === 'realtor') {
        router.replace('/dashboard/realtor');
      } else if (role === 'hr') {
        router.replace('/dashboard/hr');
      } else if (role === 'staff') {
        router.replace('/dashboard/staff');
      } else {
        router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard/client');
      }
    }
  }, [router, redirectTo]);

  // Resolve tenant ID from custom domain on mount so the X-Company-ID header
  // is sent with the login request and subsequent API calls.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hostname;
    if (h === 'localhost' || h.endsWith('.vercel.app') || h.endsWith('.railway.app')) return;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${base}/api/v1/companies/resolve?domain=${encodeURIComponent(h)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const co = res?.data || res;
        if (co?.id) setTenantId(co.id);
      })
      .catch(() => {});
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const loginHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const tid = (await import('@/lib/api')).getTenantId();
      if (tid) loginHeaders['X-Company-ID'] = tid;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/auth/login`, {
        method: 'POST',
        headers: loginHeaders,
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid credentials');
      }

      const data = await response.json();

      // Clear any stale auth data first
      clearAuth();

      // Store token and user data
      const token = data.data?.accessToken || data.accessToken;
      const user = data.data?.user || data.user;
      setAuth(token, user);

      const role = user?.role?.toLowerCase();

      toast.success('Login successful!');

      // Route based on role
      if (user?.isSuperAdmin || role === 'super_admin') {
        router.push('/dashboard/super-admin');
      } else if (role === 'general_overseer') {
        router.push('/dashboard/general-overseer');
      } else if (role === 'admin') {
        router.push('/dashboard/admin');
      } else if (role === 'realtor') {
        router.push('/dashboard/realtor');
      } else if (role === 'hr') {
        router.push('/dashboard/hr');
      } else if (role === 'staff') {
        router.push('/dashboard/staff');
      } else {
        router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard/client');
      }
    } catch (error: any) {
      const msg: string = error.message || '';
      if (msg === 'EMAIL_NOT_VERIFIED' || msg.toLowerCase().includes('verify your email')) {
        toast.error('Please verify your email before logging in.', {
          description: 'Check your inbox for the verification link.',
          action: {
            label: 'Resend',
            onClick: () => window.location.assign('/auth/verify-email'),
          },
          duration: 8000,
        });
      } else {
        toast.error(msg || 'Invalid credentials. Please ensure the backend is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/10 via-gray-50 to-accent/10 dark:from-gray-950 dark:via-gray-900 dark:to-primary/20 p-4 relative overflow-hidden">
      {/* 3-D floating bubbles */}
      {(() => {
        const ANIMS = ['bubble-a','bubble-b','bubble-c','bubble-d','bubble-e','bubble-f'];
        const bubbles = [
          { size: 110, left:  '5%', delay: '0s',    dur: '14s', color: 'hsl(var(--primary)/0.55)' },
          { size:  70, left: '18%', delay: '4s',    dur: '18s', color: 'hsl(var(--accent)/0.60)' },
          { size: 140, left: '32%', delay: '1.5s',  dur: '22s', color: 'hsl(var(--primary)/0.45)' },
          { size:  55, left: '50%', delay: '7s',    dur: '13s', color: 'hsl(var(--accent)/0.65)' },
          { size:  90, left: '63%', delay: '2.5s',  dur: '17s', color: 'hsl(var(--primary)/0.50)' },
          { size:  45, left: '78%', delay: '10s',   dur: '15s', color: 'hsl(var(--accent)/0.55)' },
          { size: 120, left: '88%', delay: '5s',    dur: '20s', color: 'hsl(var(--primary)/0.40)' },
          { size:  60, left: '12%', delay: '12s',   dur: '16s', color: 'hsl(var(--accent)/0.50)' },
          { size:  80, left: '42%', delay: '9s',    dur: '19s', color: 'hsl(var(--primary)/0.48)' },
          { size:  35, left: '72%', delay: '3s',    dur: '12s', color: 'hsl(var(--accent)/0.60)' },
        ];
        return bubbles.map((b, i) => (
          <div
            key={i}
            className="bubble"
            style={{
              width: b.size,
              height: b.size,
              left: b.left,
              animationName: ANIMS[i % ANIMS.length],
              animationDelay: b.delay,
              animationDuration: b.dur,
              ['--bubble-color' as string]: b.color,
            } as React.CSSProperties}
          />
        ));
      })()}
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          {branding.logo ? (
            <img
              src={branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)}
              alt={companyName}
              className="mx-auto h-12 w-auto object-contain mb-4"
            />
          ) : (
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          )}
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your {companyName} account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Remember me
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link
              href={redirectTo ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}` : '/auth/register'}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
