import { useEffect } from 'react';
import { initPushNotifications, isNative } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !isNative) return;

    initPushNotifications(
      async (token) => {
        // Save FCM token to user profile so the server can send targeted notifications
        await supabase
          .from('profiles')
          .update({ fcm_token: token })
          .eq('id', user.id);
      },
      (title, body) => {
        // Show in-app toast when a notification arrives while app is open
        toast({ title, description: body });
      },
    );
  }, [user]);
}
