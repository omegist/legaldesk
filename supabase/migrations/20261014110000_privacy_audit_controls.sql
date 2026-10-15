-- Privacy controls: user-visible export/delete requests and server-only audit log.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('account_deletion')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'in_review', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, request_type, status)
);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own privacy requests"
  ON public.privacy_requests FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users request own account deletion"
  ON public.privacy_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND request_type = 'account_deletion' AND status = 'requested');

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
-- No client policies: audit events are for authorised support/admin review only.

CREATE OR REPLACE FUNCTION public.record_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id UUID;
BEGIN
  row_id := CASE WHEN TG_OP = 'DELETE'
    THEN (to_jsonb(OLD)->>'id')::uuid
    ELSE (to_jsonb(NEW)->>'id')::uuid
  END;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id)
  VALUES (
    auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
    TG_TABLE_NAME,
    row_id
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_diaries ON public.diaries;
CREATE TRIGGER audit_diaries AFTER INSERT OR UPDATE OR DELETE ON public.diaries
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS audit_documents ON public.documents;
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_event();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_event();
