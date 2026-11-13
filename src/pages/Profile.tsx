import { useEffect, useState } from 'react';
import { Loader2, Save, Camera, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    practice_area: '',
    court_name: '',
    city: '',
    experience_years: '',
    description: '',
  });
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const AVATAR_BUCKET = 'avatars';

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image is too large', description: 'Please choose one under 5MB.', variant: 'destructive' });
      return;
    }

    setIsUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    // One file per user (fixed name), so re-uploading replaces the old photo
    // instead of accumulating unused files in the bucket.
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setIsUploadingPhoto(false);
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    // Cache-bust so the new photo shows immediately even though the path is identical.
    const photoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_photo_url: photoUrl })
      .eq('id', user.id);

    setIsUploadingPhoto(false);

    if (updateError) {
      toast({ title: 'Could not save photo', description: updateError.message, variant: 'destructive' });
      return;
    }

    await refreshProfile();
    toast({ title: 'Profile photo updated' });
  };

  useEffect(() => {
    if (!profile || !user) return;
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      practice_area: profile.practice_area ?? '',
      court_name: profile.court_name ?? '',
      city: profile.city ?? '',
      experience_years: profile.experience_years?.toString() ?? '',
      description: profile.description ?? '',
    });

    if (profile.role === 'lawyer') {
      supabase
        .from('lawyer_private_details')
        .select('enrollment_number')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setEnrollmentNumber(data?.enrollment_number ?? ''));
    }
    setIsLoading(false);
  }, [profile, user]);

  const isFirmOwner = !!profile?.firm_id && profile.firm_id === user?.id;

  const handleLogoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Logo too large', description: 'Please choose one under 2MB.', variant: 'destructive' });
      return;
    }
    setIsUploadingLogo(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/firm-logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true });
    if (uploadError) {
      setIsUploadingLogo(false);
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ firm_logo_url: logoUrl }).eq('id', user.id);
    setIsUploadingLogo(false);
    await refreshProfile();
    toast({ title: 'Firm logo updated' });
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setIsSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: form.name,
        phone: form.phone || null,
        practice_area: form.practice_area || null,
        court_name: form.court_name || null,
        city: form.city || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        description: form.description || null,
      })
      .eq('id', user.id);

    let privateError = null;
    if (profile.role === 'lawyer' && enrollmentNumber.trim()) {
      const { error } = await supabase
        .from('lawyer_private_details')
        .upsert({ user_id: user.id, enrollment_number: enrollmentNumber.trim() }, { onConflict: 'user_id' });
      privateError = error;
    }

    setIsSaving(false);
    if (profileError || privateError) {
      toast({
        title: 'Could not save changes',
        description: (profileError || privateError)?.message,
        variant: 'destructive',
      });
      return;
    }
    await refreshProfile();
    toast({ title: 'Profile updated' });
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    const { data, error } = await supabase.functions.invoke('export-my-data');
    setIsExportingData(false);
    if (error || !data) {
      toast({
        title: 'Could not export data',
        description: error?.message || 'Please try again or contact support.',
        variant: 'destructive',
      });
      return;
    }
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vakildesk-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Data export downloaded', description: 'Download your Vault files separately before requesting deletion.' });
  };

  const handleDeletionRequest = async () => {
    if (!window.confirm('Request account deletion? Download your data and Vault files first. This request will be reviewed before permanent deletion.')) return;
    setIsRequestingDeletion(true);
    const { error } = await supabase.functions.invoke('request-account-deletion');
    setIsRequestingDeletion(false);
    if (error) {
      toast({ title: 'Could not submit request', description: 'Please try again or contact support.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Deletion request submitted', description: 'Your request is recorded for review. Keep a copy of your export and Vault files.' });
  };

  const handleFeedback = async () => {
    if (feedback.trim().length < 3) {
      toast({ title: 'Add a little more detail', description: 'Feedback must be at least 3 characters.', variant: 'destructive' });
      return;
    }
    setIsSubmittingFeedback(true);
    const { error } = await supabase.functions.invoke('submit-feedback', { body: { message: feedback } });
    setIsSubmittingFeedback(false);
    if (error) {
      toast({ title: 'Could not submit feedback', description: 'Please try again later.', variant: 'destructive' });
      return;
    }
    setFeedback('');
    toast({ title: 'Thank you', description: 'Your feedback has been sent to the VakilDesk team.' });
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background legal-pattern">
        <Header />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={profile.profile_photo_url ?? undefined} alt={profile.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {profile.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
              aria-label="Change profile photo"
            >
              {isUploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
              disabled={isUploadingPhoto}
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold">{profile.name || 'Your profile'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="capitalize border-primary/30">{profile.role}</Badge>
              <Badge variant="outline" className="capitalize border-primary/30">
                {profile.subscription_tier} plan
              </Badge>
            </div>
          </div>
        </div>

        {isFirmOwner && (
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Firm branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Your firm logo appears on all generated invoices and PDF templates.</p>
              <div className="flex items-center gap-4">
                {profile.firm_logo_url && (
                  <img src={profile.firm_logo_url} alt="Firm logo" className="h-14 w-auto rounded border border-border/60 object-contain bg-white p-1" />
                )}
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50"
                >
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {profile.firm_logo_url ? 'Change logo' : 'Upload logo'}
                </label>
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoSelected} disabled={isUploadingLogo} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass-effect border-primary/20">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <Field label="Email" value={profile.email} disabled />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          </CardContent>
        </Card>

        <Card className="glass-effect border-primary/20">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Share feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              maxLength={2000}
              placeholder="What should VakilDesk improve? Please do not include confidential case details."
              className="bg-secondary/50"
            />
            <Button variant="outline" className="w-full" onClick={handleFeedback} disabled={isSubmittingFeedback || feedback.trim().length < 3}>
              {isSubmittingFeedback ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send feedback
            </Button>
          </CardContent>
        </Card>

        {profile.role === 'lawyer' && (
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Practice details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Enrollment number"
                value={enrollmentNumber}
                onChange={setEnrollmentNumber}
                helper="Stored separately and never shown in the public directory."
              />
              <Field
                label="Practice area"
                value={form.practice_area}
                onChange={(v) => setForm((f) => ({ ...f, practice_area: v }))}
                placeholder="e.g. Criminal, Civil, Family"
              />
              <Field
                label="Primary court"
                value={form.court_name}
                onChange={(v) => setForm((f) => ({ ...f, court_name: v }))}
                placeholder="e.g. Thane District Court"
              />
              <Field
                label="Years of experience"
                type="number"
                value={form.experience_years}
                onChange={(v) => setForm((f) => ({ ...f, experience_years: v }))}
              />
              <div className="space-y-2">
                <Label>About</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="A short line shown to prospective partners and clients."
                  className="bg-secondary/50"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-full gold-gradient text-primary-foreground">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save changes
            </>
          )}
        </Button>

        <Card className="glass-effect border-primary/20">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Data &amp; privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Download your account data at any time. Your export includes case, billing and document metadata; download original Vault files separately.</p>
            <Button variant="outline" className="w-full" onClick={handleExportData} disabled={isExportingData}>
              {isExportingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download my data
            </Button>
            <div className="border-t border-destructive/30 pt-4">
              <p className="mb-3 text-sm text-muted-foreground">Account deletion requests are reviewed to protect active matters, invoices and team records. Export your data first.</p>
              <Button variant="destructive" className="w-full" onClick={handleDeletionRequest} disabled={isRequestingDeletion}>
                {isRequestingDeletion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Request account deletion
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
  placeholder,
  helper,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  helper?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="bg-secondary/50"
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
