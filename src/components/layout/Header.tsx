import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Scale, User, LogOut, LayoutDashboard, FolderLock, Users, Bell, Briefcase, CreditCard, FileText, IndianRupee, BookOpen, Building2, CalendarDays, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const lawyerNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Cases', href: '/cases', icon: Briefcase },
  { label: 'Legal Vault', href: '/vault', icon: FolderLock },
  { label: 'Partners', href: '/partners', icon: Users },
  { label: 'Reminders', href: '/settings/notifications', icon: Bell },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Fee Ledger', href: '/fee-ledger', icon: IndianRupee },
  { label: 'Templates', href: '/templates', icon: BookOpen },
];

const partnerNavItems = [
  { label: 'Workspace', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Shared Cases', href: '/cases', icon: Briefcase },
  { label: 'Partners', href: '/partners', icon: Users },
  { label: 'Reminders', href: '/settings/notifications', icon: Bell },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
];

const bottomNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cases', href: '/cases', icon: Briefcase },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Vault', href: '/vault', icon: FolderLock },
];

export function Header() {
  const { profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const baseItems = profile?.role === 'partner' ? partnerNavItems : lawyerNavItems;
  // Keep paid features discoverable. Routes enforce the subscription and show
  // a clear upgrade screen instead of hiding the navigation item.
  const navItems = [...baseItems, { label: 'Team', href: '/team', icon: Building2 }, { label: 'Calendar', href: '/calendar', icon: CalendarDays }];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            <span className="font-serif text-xl font-semibold text-gold-gradient">VakilDesk</span>
          </Link>

          {isAuthenticated ? (
            <>
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      isActive(item.href) ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
                  {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10 border-2 border-primary/20">
                        <AvatarImage src={profile?.profile_photo_url ?? undefined} alt={profile?.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {profile?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <div className="flex flex-col p-2">
                      <span className="text-sm font-medium">{profile?.name || 'Your account'}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {profile?.role} · {profile?.subscription_tier} plan
                      </span>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/pricing')}>
                      <Scale className="mr-2 h-4 w-4" />
                      Plans
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                  <SheetTrigger asChild className="hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px]">
                    <nav className="flex flex-col gap-4 mt-10">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 text-lg font-medium transition-colors hover:text-primary ${
                            isActive(item.href) ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Link>
                      ))}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 text-lg font-medium text-destructive"
                      >
                        <LogOut className="h-5 w-5" />
                        Log out
                      </button>
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/pricing')} className="hidden sm:inline-flex">
                Pricing
              </Button>
              <Button onClick={() => navigate('/auth')} className="gold-gradient text-primary-foreground">
                Sign In
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur border-t border-border/40">
          <div className="flex items-center justify-around h-16 px-2">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
                  isActive(item.href) ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={() => setIsOpen(true)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 text-muted-foreground transition-colors`}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
