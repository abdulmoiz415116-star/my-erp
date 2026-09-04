'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/common/PageHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useToast } from '@/context/ToastContext';
import {
  User,
  Shield,
  Key,
  Building2,
  Mail,
  Phone,
  Calendar,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function ProfilePage() {
  const { user, updateUserProfile, changePassword } = useAuth();
  const { currentTenant, userRole } = useTenant();
  const { permissions } = usePermissions();
  const { showToast } = useToast();

  // Profile Edit State
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfile({ displayName, phone });
      showToast('Profile information updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password changed successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password. Please verify current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="User Profile & Security Settings"
        subtitle={`Personal credentials and access governance in ${currentTenant?.name}`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3.5 h-3.5" />
            {userRole.toUpperCase()} ROLE
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Overview & Session Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'AD'}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">{user?.displayName || 'User'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <StatusBadge status={user?.status || 'active'} />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                {userRole}
              </span>
            </div>

            <div className="pt-4 border-t border-slate-100 text-left text-xs text-slate-600 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-500">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Workspace: {currentTenant?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Last Session: {formatDateTime(user?.lastLoginAt)}</span>
              </div>
            </div>
          </div>

          {/* Assigned Permissions Preview Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Granted Capabilities
              </h4>
              <span className="text-[10px] font-mono text-slate-400">{permissions.length} Active</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Role permissions strictly enforced via Firestore Security Rules.
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
              {permissions.map((perm) => (
                <span
                  key={perm}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-50 text-slate-700 border border-slate-200"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Columns: Profile Form & Change Password Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Details Form */}
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500">Update your public identity within this workspace</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Display Full Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <Input
                label="Registered Email"
                type="email"
                value={user?.email || ''}
                disabled
                helperText="Primary email cannot be changed directly."
              />
            </div>

            <Input
              label="Contact Phone Number"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button type="submit" size="sm" loading={savingProfile}>
                <Save className="w-4 h-4" />
                Save Profile Changes
              </Button>
            </div>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Change Authentication Password</h3>
                <p className="text-xs text-slate-500">Secure credential rotation with re-authentication</p>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {passwordError}
              </div>
            )}

            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button type="submit" size="sm" variant="warning" loading={savingPassword}>
                <Lock className="w-4 h-4" />
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
