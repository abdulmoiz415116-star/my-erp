'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Layers, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Layers className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-white tracking-tight">
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Enter your registered enterprise email address to receive reset instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Reset Email Dispatched</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an account exists for <strong className="text-slate-800">{email}</strong>, a secure password reset link has been dispatched. Please check your inbox and spam folders.
              </p>
              <div className="pt-3 border-t border-slate-100">
                <Link href="/login">
                  <Button variant="outline" className="w-full text-xs">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Enterprise Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Button type="submit" className="w-full" loading={loading}>
                Send Password Reset Email
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
