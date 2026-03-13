'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { setAuth, clearAuth, getToken, getUser } from '@/lib/auth-storage';
import { getImageUrl } from '@/lib/api';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';

export default function LoginPage() {
  const router = useRouter();
  const branding = usePlatformBranding();
  const platformName = getPlatformName(branding);

  // If already authenticated as super_admin, redirect to dashboard
  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      const role = (user as any).role?.toLowerCase();
      if ((user as any).isSuperAdmin || role === 'super_admin') {
        router.replace('/dashboard');
      }
    }
  }, [router]);

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

      const role = user?.role?.toLowerCase();

      // Check super_admin role
      if (!user?.isSuperAdmin && role !== 'super_admin') {
        toast.error('Access denied. This portal is for platform administrators only.');
        setIsLoading(false);
        return;
      }

      setAuth(token, user);
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (error: any) {
      const msg: string = error.message || '';
      if (msg === 'EMAIL_NOT_VERIFIED' || msg.toLowerCase().includes('verify your email')) {
        toast.error('Please verify your email before logging in.', {
          description: 'Check your inbox for the verification link.',
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
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 relative overflow-hidden">
      {/* Floating bubbles */}
      {[
        { size: 48, left: '8%',  delay: '0s',   duration: '12s', color: 'hsl(var(--primary)/0.12)' },
        { size: 28, left: '20%', delay: '3s',   duration: '15s', color: 'hsl(var(--accent)/0.15)' },
        { size: 64, left: '35%', delay: '1.5s', duration: '18s', color: 'hsl(var(--primary)/0.08)' },
        { size: 20, left: '55%', delay: '5s',   duration: '11s', color: 'hsl(var(--primary)/0.14)' },
        { size: 40, left: '70%', delay: '2s',   duration: '14s', color: 'hsl(var(--accent)/0.10)' },
        { size: 32, left: '85%', delay: '7s',   duration: '16s', color: 'hsl(var(--primary)/0.10)' },
        { size: 18, left: '92%', delay: '4s',   duration: '13s', color: 'hsl(var(--accent)/0.12)' },
      ].map((b, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            animationDelay: b.delay,
            animationDuration: b.duration,
            background: b.color,
          }}
        />
      ))}
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          {branding.logo ? (
            <img
              src={branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)}
              alt={platformName}
              className="mx-auto h-12 w-auto object-contain mb-4"
            />
          ) : (
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
              <Crown className="w-6 h-6 text-white" />
            </div>
          )}
          <CardTitle className="text-2xl">Platform Administration</CardTitle>
          <CardDescription>Sign in to {platformName} Super Admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="superadmin@example.com"
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
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 text-center font-medium">
              This portal is restricted to Super Administrators only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
