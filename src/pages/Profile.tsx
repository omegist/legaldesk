import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
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
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src={profile.profile_photo_url ?? undefined} alt={profile.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {profile.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
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