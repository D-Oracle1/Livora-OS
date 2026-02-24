'use client';

import { Suspense } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;
    setStatus('loading');
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${base}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully.');
          setTimeout(() => router.push('/auth/login'), 3000);
        } else {
          setStatus('error');
          setMessage(data.message || 'Invalid or expired link.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [token, router]);

  const handleResend = async () => {
    if (!resendEmail.trim() || resending) return;
    setResending(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${base}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center space-y-5">

      {/* No token — show resend form */}
      {!token && (
        <>
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a verification link to your email address. Click the link to activate your account.
          </p>
          <p className="text-xs text-gray-400">Didn&apos;t receive it? Enter your email below to resend.</p>

          {resent ? (
            <p className="text-sm text-emerald-600 font-medium">
              Verification email sent! Check your inbox (and spam folder).
            </p>
          ) : (
            <div className="flex gap-2 mt-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-gray-800 placeholder:text-gray-400"
              />
              <button
                onClick={handleResend}
                disabled={!resendEmail.trim() || resending}
                className="h-10 px-4 text-sm font-medium bg-blue-600 text-white rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend'}
              </button>
            </div>
          )}

          <Link href="/auth/login" className="block text-sm text-blue-600 hover:underline mt-2">
            Back to Login
          </Link>
        </>
      )}

      {/* Token present — show verification status */}
      {token && status === 'loading' && (
        <>
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Verifying your email…</h1>
          <p className="text-sm text-gray-500">Just a moment.</p>
        </>
      )}

      {token && status === 'success' && (
        <>
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Email Verified!</h1>
          <p className="text-sm text-gray-500">{message}</p>
          <p className="text-xs text-gray-400">Redirecting to login…</p>
          <Link href="/auth/login" className="block text-sm text-blue-600 hover:underline">
            Go to Login
          </Link>
        </>
      )}

      {token && status === 'error' && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <XCircle className="w-9 h-9 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Verification Failed</h1>
          <p className="text-sm text-gray-500">{message}</p>

          {resent ? (
            <p className="text-sm text-emerald-600 font-medium">
              New verification email sent! Check your inbox.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400">Enter your email to get a new verification link.</p>
              <div className="flex gap-2 mt-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-gray-800 placeholder:text-gray-400"
                />
                <button
                  onClick={handleResend}
                  disabled={!resendEmail.trim() || resending}
                  className="h-10 px-4 text-sm font-medium bg-blue-600 text-white rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend'}
                </button>
              </div>
            </>
          )}

          <Link href="/auth/login" className="block text-sm text-blue-600 hover:underline mt-2">
            Back to Login
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
