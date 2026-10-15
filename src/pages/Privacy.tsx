import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';

export default function Privacy() {
  return (
    <main className="min-h-screen bg-background legal-pattern">
      <div className="container max-w-3xl py-10 md:py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 font-serif text-xl font-semibold text-primary">
          <Scale className="h-6 w-6" /> VakilDesk
        </Link>
        <article className="space-y-8 rounded-2xl border border-primary/20 bg-card/90 p-6 shadow-sm md:p-10">
          <header>
            <h1 className="font-serif text-3xl font-bold">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: 16 October 2026</p>
          </header>
          <PolicySection title="What VakilDesk does">VakilDesk is a practice-management service for legal professionals. It helps users manage matters, hearing dates, reminders, invoices, team access and documents.</PolicySection>
          <PolicySection title="Information we collect">We collect account and profile information such as your name, email address, phone number and practice details. We also process information you choose to add to VakilDesk, including case records, hearing dates, notes, invoices, fee records, team details and document files. When enabled, we store notification-device tokens so we can send reminders. We also record limited product events and feedback to improve the service.</PolicySection>
          <PolicySection title="How we use information">We use information to provide and secure VakilDesk, authenticate accounts, store and display your records, send requested email or push reminders, provide support, prevent misuse, and improve the product. We do not sell personal information or use case data for advertising.</PolicySection>
          <PolicySection title="Service providers and sharing">VakilDesk uses service providers to operate the service, including Supabase for authentication and application data, Cloudflare R2 for document storage, Resend for transactional email, Firebase for push notifications, and Razorpay for website subscription payments. Information is shared with these providers only as needed to provide their services. Team members may see records that a firm or chambers owner shares with them through VakilDesk.</PolicySection>
          <PolicySection title="Security and retention">We use access controls and authenticated service providers to protect information. No online service can guarantee absolute security. We retain account data while your account is active and as needed for legitimate operational, legal, billing and security purposes. Please avoid putting unnecessary confidential information into free-text fields.</PolicySection>
          <PolicySection title="Your choices: export and deletion">You can export your account data from Profile → Data &amp; privacy. To request account deletion, sign in and select Profile → Data &amp; privacy → Request account deletion. Download your data and original Vault documents before submitting the request. We review requests to protect active matters, invoices and shared team records, then delete or de-identify applicable personal data subject to legal, security and record-keeping obligations.<Link to="/delete-account" className="mt-3 block text-primary underline underline-offset-4">Read account-deletion instructions</Link></PolicySection>
          <PolicySection title="Children">VakilDesk is intended for legal professionals and is not directed to children.</PolicySection>
          <PolicySection title="Changes to this policy">We may update this policy as VakilDesk changes. We will post the current version on this page and update the date above.</PolicySection>
        </article>
      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="font-serif text-xl font-semibold">{title}</h2><div className="mt-2 leading-7 text-muted-foreground">{children}</div></section>;
}
