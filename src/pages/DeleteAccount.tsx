import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';

export default function DeleteAccount() {
  return (
    <main className="min-h-screen bg-background legal-pattern">
      <div className="container max-w-3xl py-10 md:py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 font-serif text-xl font-semibold text-primary"><Scale className="h-6 w-6" /> VakilDesk</Link>
        <article className="rounded-2xl border border-primary/20 bg-card/90 p-6 shadow-sm md:p-10">
          <h1 className="font-serif text-3xl font-bold">Delete your VakilDesk account</h1>
          <p className="mt-4 leading-7 text-muted-foreground">You can request deletion of your VakilDesk account and associated personal data directly in the app.</p>
          <ol className="mt-6 list-decimal space-y-3 pl-5 leading-7 text-muted-foreground"><li>Sign in to VakilDesk.</li><li>Open <strong className="text-foreground">Profile</strong>.</li><li>In <strong className="text-foreground">Data &amp; privacy</strong>, first select <strong className="text-foreground">Download my data</strong> and download any original Vault files you need.</li><li>Select <strong className="text-foreground">Request account deletion</strong> and confirm your request.</li></ol>
          <p className="mt-6 leading-7 text-muted-foreground">Deletion requests are reviewed to protect active matters, invoices and shared team records. We delete or de-identify applicable personal data, except where retention is needed for legal, fraud-prevention, security or accounting obligations.</p>
          <Link to="/privacy" className="mt-8 inline-block text-primary underline underline-offset-4">Read the Privacy Policy</Link>
        </article>
      </div>
    </main>
  );
}
