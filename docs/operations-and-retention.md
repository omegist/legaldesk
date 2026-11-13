# VakilDesk production operations and retention policy

Status: internal launch policy. Have Indian legal counsel review this document
before publishing matching Privacy Policy and Terms pages to customers.

## Support workflow

- Support requests and deletion requests are reviewed by an authorised
  VakilDesk administrator.
- Account-deletion requests are stored in `privacy_requests` with a status.
- Before deleting an account, verify the requestor's identity and check for
  active firm memberships, unpaid subscriptions, invoices, and legal retention
  obligations.
- Record the completion or rejection date and reason in the internal support
  process. Do not put client matter content in support tickets.

## Retention

- Customer data is retained while the account is active.
- On a verified account-deletion request, export is made available immediately
  through the Profile > Data & privacy control. Original Vault files must be
  downloaded separately by the user.
- Deletion is completed after review, normally within 30 days, unless VakilDesk
  must retain limited billing, security, fraud-prevention, or other records to
  meet a legal obligation.
- Audit-event metadata records the actor, action, entity type, entity ID, and
  timestamp. It never stores case text or document content. Retain audit events
  for 12 months for security and incident investigation, unless a longer period
  is legally required.
- Database backups must use the provider's point-in-time recovery/backup option
  and be access-restricted. Review successful backups monthly and perform a
  test restore at least quarterly in a separate project.
- R2 documents need a separate encrypted backup/export process. Test restore of
  a small document sample quarterly. Never test restoration over production
  objects.

## Monitoring and incidents

- Review Supabase function errors, database advisories, Resend delivery errors,
  Razorpay webhook failures, and Cloudflare Worker logs weekly.
- Alert on failed payment webhooks, repeated authentication failures, scheduled
  reminder failures, and R2 Worker errors.
- Cloudflare Worker Logs and Traces are enabled for the document Worker.
- For a suspected breach, revoke exposed keys, preserve audit evidence, assess
  affected records, and follow the incident-notification requirements advised
  by counsel.
