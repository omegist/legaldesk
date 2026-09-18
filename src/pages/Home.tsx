import { useNavigate } from 'react-router-dom';
import { Scale, Shield, Users, BookOpen, Clock, Lock } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-background legal-pattern">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-24 lg:py-32">
          <div className="flex flex-col items-center text-center space-y-8">
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
                  onClick={() => navigate('/get-started')}
                  className="gold-gradient text-primary-foreground text-lg px-8"
                >
                  Get Started
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
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
              </Button>
            )}
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
                Join lawyers across India who trust Legal Diary for their case management needs.
              </p>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  onClick={() => navigate('/get-started')}
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="font-serif text-lg font-semibold">Legal Diary</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Legal Diary. Built for Indian Legal Professionals.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
