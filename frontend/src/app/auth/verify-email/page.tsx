'use client';

import { Suspense } from 'react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const emailParam = params.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6 || !email.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${base}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.push('/auth/login'), 2500);
      } else {
        setStatus('error');
        setErrorMsg(data.message || 'Invalid code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  const handleResend = async () => {
    if (!email.trim() || resending || countdown > 0) return;
    setResending(true);
    setResent(false);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${base}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResent(true);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9 text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Email Verified!</h1>
        <p className="text-sm text-gray-500">Your account is now active. Redirecting to login…</p>
        <Link href="/auth/login" className="block text-sm text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center space-y-6">
      {/* Icon + heading */}
      <div className="space-y-3">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Check your email</h1>
        <p className="text-sm text-gray-500">
          We sent a 6-digit verification code to{' '}
          {email ? <span className="font-medium text-gray-700">{email}</span> : 'your email address'}.
        </p>
      </div>

      {/* Email input (editable if not pre-filled) */}
      {!emailParam && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 text-gray-800 placeholder:text-gray-400"
        />
      )}

      {/* OTP boxes */}
      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors
              ${digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-800'}
              focus:border-blue-500 focus:bg-blue-50
              ${status === 'error' ? 'border-red-300' : ''}`}
          />
        ))}
      </div>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
      )}

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={otp.join('').length < 6 || !email.trim() || status === 'loading'}
        className="w-full h-11 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        Verify Email
      </button>

      {/* Resend */}
      <div className="text-sm text-gray-500 space-y-1">
        {resent && (
          <p className="text-emerald-600 font-medium text-xs">New code sent — check your inbox.</p>
        )}
        <button
          onClick={handleResend}
          disabled={!email.trim() || resending || countdown > 0}
          className="flex items-center gap-1 mx-auto text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive it? Resend code"}
        </button>
      </div>

      <Link href="/auth/login" className="block text-sm text-gray-400 hover:text-gray-600">
        Back to Login
      </Link>
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
