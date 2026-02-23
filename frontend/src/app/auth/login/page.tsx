'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const branding = useBranding();
  const companyName = getCompanyName(branding);

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
        router.replace('/dashboard/client');
      }
    }
  }, [router]);

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
        router.push('/dashboard/client');
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid credentials. Please ensure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/auth/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
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
          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('google')}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('facebook')}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-900 px-4 text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

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
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center mb-2 font-semibold">Demo Accounts:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium">Admin:</span> admin@rms.com</p>
              <p><span className="font-medium">Realtor:</span> sarah.johnson@rms.com</p>
              <p><span className="font-medium">Client:</span> john.doe@email.com</p>
              <p className="text-primary font-medium">Password: Admin123!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
