import { Link, useNavigate } from 'react-router-dom';
import { Scale, Shield, Users, BookOpen, Clock, Lock, Quote, ArrowRight, Gavel, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: BookOpen,
      title: 'Structured Diary Entries',
      description: 'Replace your physical diary with professionally formatted digital entries.',
    },
    {
      icon: Shield,
      title: 'Role-Based Access',
      description: 'Complete control over who sees and edits your legal matters.',
    },
    {
      icon: Users,
      title: 'Partner Management',
      description: 'Collaborate with associates while maintaining data ownership.',
    },
    {
      icon: Clock,
      title: 'Smart Reminders',
      description: 'Never miss a hearing date with intelligent case reminders.',
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your enrollment number and sensitive data stays protected.',
    },
    {
      icon: Scale,
      title: 'Professional Grade',
      description: 'Built specifically for Indian legal professionals.',
    },
  ];

  const howItWorks = [
    {
      icon: BookOpen,
      title: 'Create Your Diary',
      description: 'Sign up and add your first case in under 2 minutes.',
    },
    {
      icon: Gavel,
      title: 'Track Every Hearing',
      description: 'Get reminders, sync with eCourts, and never miss a date.',
    },
    {
      icon: Shield,
      title: 'Collaborate Securely',
      description: 'Share cases with partners while keeping client data private.',
    },
  ];

  const testimonials = [
    {
      quote: 'VakilDesk replaced my physical diary completely. I never miss a hearing date now.',
      name: 'Adv. Priya Sharma',
      court: 'District Court, Mumbai',
      color: 'bg-amber-500',
    },
    {
      quote: 'The CNR sync feature saves me 30 minutes every day. Highly recommended for busy practitioners.',
      name: 'Adv. Rajesh Patil',
      court: 'High Court, Pune',
      color: 'bg-primary',
    },
    {
      quote: 'Finally a digital tool built for Indian lawyers. The client portal is a game changer.',
      name: 'Adv. Meera Iyer',
      court: 'Family Court, Bangalore',
      color: 'bg-yellow-600',
    },
  ];

  const stats = [
    { value: '500+', label: 'Active Advocates' },
    { value: '10,000+', label: 'Cases Managed' },
    { value: '50+', label: 'Courts Covered' },
  ];

  return (
    <div className="min-h-screen bg-background legal-pattern">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(196,155,60,0.4) 0%, rgba(217,169,55,0.15) 40%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)',
          }}
        />

        <div className="container relative py-24 lg:py-32">
          <div className="flex flex-col items-center text-center space-y-8 animate-[fadeInUp_0.8s_ease-out]">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">For Legal Professionals</span>
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl">
              Your Private{' '}
              <span className="text-gold-gradient">Digital Court Diary</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              A structured, permission-controlled diary for lawyers and legal associates in India.
              Replace messy notebooks with organized, professional case management.
            </p>

            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="gold-gradient text-primary-foreground text-lg px-8"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="text-lg px-8"
                >
                  Sign In
                </Button>
              </div>
            )}

            {isAuthenticated && (
              <Button
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="gold-gradient text-primary-foreground text-lg px-8"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}

            {/* Trust Badge */}
            <div className="flex flex-col items-center gap-3 pt-4 animate-[fadeInUp_1s_ease-out]">
              <div className="flex -space-x-2">
                {['bg-amber-500', 'bg-primary', 'bg-yellow-600', 'bg-orange-500', 'bg-amber-400'].map(
                  (color, i) => (
                    <div
                      key={i}
                      className={`h-8 w-8 rounded-full ${color} border-2 border-background ring-1 ring-primary/20`}
                    />
                  )
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Trusted by advocates across India
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 relative">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              How It <span className="text-gold-gradient">Works</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
            {/* Dotted connector line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] border-t-2 border-dashed border-primary/30" />

            {howItWorks.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center relative">
                {/* Number badge */}
                <div className="relative z-10 h-14 w-14 rounded-full gold-gradient flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                  <span className="font-serif text-xl font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                </div>

                {/* Mobile arrow between steps */}
                {index < howItWorks.length - 1 && (
                  <div className="md:hidden absolute -bottom-6 left-1/2 -translate-x-1/2">
                    <ChevronRight className="h-5 w-5 text-primary/40 rotate-90" />
                  </div>
                )}

                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Built for Legal Excellence
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every feature designed with practicing lawyers in mind
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group bg-card/80 border-border/50 hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              What Advocates <span className="text-gold-gradient">Say</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Hear from lawyers who transformed their practice with VakilDesk
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="bg-card/80 border-border/50 hover:border-primary/20 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <Quote className="h-8 w-8 text-primary/30 mb-4" />
                  <p className="text-foreground/90 mb-6 italic leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full ${testimonial.color} flex items-center justify-center`}>
                      <span className="text-sm font-bold text-white">
                        {testimonial.name.split(' ').slice(-1)[0][0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.court}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card/30">
        <div className="container">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="font-serif text-4xl md:text-5xl font-bold text-gold-gradient mb-2">
                  {stat.value}
                </p>
                <p className="text-sm md:text-base text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <Card className="glass-effect border-primary/20 overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center">
              <Scale className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
                Start Organizing Today
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Join lawyers across India who trust VakilDesk for their case management needs.
              </p>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="gold-gradient text-primary-foreground text-lg px-8"
                >
                  Create Your Diary
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Logo + tagline */}
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <span className="font-serif text-lg font-semibold">VakilDesk</span>
                <p className="text-xs text-muted-foreground">Your Digital Court Diary</p>
              </div>
            </div>

            {/* Center: Links */}
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link to="/delete-account" className="hover:text-primary transition-colors">
                Delete Account
              </Link>
              <Link to="/pricing" className="hover:text-primary transition-colors">
                Pricing
              </Link>
            </div>

            {/* Right: Copyright */}
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} VakilDesk. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Keyframe animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
