import { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { NotificationSettings as NotificationSettingsType } from '@/types';

// Matches the real `reminder_hours: number[]` column â€” e.g. [24, 2] means
// "remind me 24 hours before, and again 2 hours before."
const HOUR_OPTIONS = [24, 12, 6, 2, 1];

const DEFAULTS: Omit<NotificationSettingsType, 'user_id' | 'created_at' | 'updated_at'> = {
  email_enabled: true,
  whatsapp_enabled: false,
  sms_enabled: false,
  reminder_hours: [24, 2],
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data);
        setIsLoading(false);
      });
  }, [user]);

  const toggleHour = (h: number) => {
    setSettings((s) => ({
      ...s,
      reminder_hours: s.reminder_hours.includes(h)
        ? s.reminder_hours.filter((x) => x !== h)
        : [...s.reminder_hours, h].sort((a, b) => b - a),
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    // upsert: the row may not exist yet for a brand-new account
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: user.id, ...settings }, { onConflict: 'user_id' });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Could not save preferences', description: error.message, variant: 'destructive' });
      return;
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6 space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold mb-1">Notification settings</h1>
          <p className="text-sm text-muted-foreground">
            Choose how and when your hearing reminders reach you.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Reminder channels</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                <ChannelRow
                  icon={Mail}
                  title="Email reminders"
                  subtitle="Recommended Â· powered by Resend"
                  checked={settings.email_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, email_enabled: v }))}
                />
                <ChannelRow
                  icon={MessageCircle}
                  title="WhatsApp reminders"
                  subtitle="Sending integration coming soon"
                  checked={settings.whatsapp_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, whatsapp_enabled: v }))}
                />
                <ChannelRow
                  icon={Smartphone}
                  title="SMS reminders"
                  subtitle="Sending integration coming soon"
                  checked={settings.sms_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, sms_enabled: v }))}
                />
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground px-1">
              WhatsApp and SMS preferences are saved now; delivery will be enabled in a future update.
            </p>

            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Reminder timing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Send a reminder this many hours before each hearing (pick as many as you like):
                </p>
                <div className="flex flex-wrap gap-2">
                  {HOUR_OPTIONS.map((h) => {
                    const active = settings.reminder_hours.includes(h);
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggleHour(h)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {h} {h === 1 ? 'hour' : 'hours'}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full gold-gradient text-primary-foreground"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save preferences'}
              </Button>
              {justSaved && (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-500">
                  <Check className="h-4 w-4" />
                  Preferences saved just now
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ChannelRow({
  icon: Icon,
  title,
  subtitle,
  checked,
  onCheckedChange,
}: {
  icon: typeof Mail;
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={`Enable ${title}`} />
    </div>
  );
}