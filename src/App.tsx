import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FeatureGate } from "@/components/auth/FeatureGate";
import { initStatusBar, initBackButton } from "@/lib/native";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateCase from "./pages/CreateCase";
import CaseDetail from "./pages/CaseDetail";
import Cases from "./pages/cases";
import Vault from "./pages/Vault";
import NotificationSettings from "./pages/NotificationSettings";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
import Partners from "./pages/Partners";
import CreateInvoice from "./pages/CreateInvoice";
import Invoices from "./pages/Invoices";
import FeeLedger from "./pages/FeeLedger";
import Templates from "./pages/Templates";
import ClientPortal from "./pages/ClientPortal";
import Team from "./pages/Team";
import Calendar from "./pages/Calendar";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import DeleteAccount from "./pages/DeleteAccount";

const queryClient = new QueryClient();

const protect = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;
const proFeature = (element: JSX.Element, feature: string, description: string) => (
  <ProtectedRoute>
    <FeatureGate minimumTier="pro" feature={feature} description={description}>{element}</FeatureGate>
  </ProtectedRoute>
);
const teamFeature = (element: JSX.Element, feature: string, description: string) => (
  <ProtectedRoute>
    <FeatureGate minimumTier="chambers" feature={feature} description={description}>{element}</FeatureGate>
  </ProtectedRoute>
);

function NativeInit() {
  const navigate = useNavigate();
  usePushNotifications();
  useEffect(() => {
    initStatusBar();
    initBackButton(() => navigate(-1));
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NativeInit />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/dashboard" element={protect(<Dashboard />)} />
            <Route path="/cases" element={protect(<Cases />)} />
            <Route path="/cases/new" element={protect(<CreateCase />)} />
            <Route path="/cases/:id" element={protect(<CaseDetail />)} />
            <Route path="/vault" element={proFeature(<Vault />, "Legal Vault", "Store and protect your case documents securely.")} />
            <Route path="/partners" element={protect(<Partners />)} />
            <Route path="/settings/notifications" element={proFeature(<NotificationSettings />, "Hearing reminders", "Set email reminders for upcoming hearings.")} />
            <Route path="/profile" element={protect(<Profile />)} />
            <Route path="/invoices" element={proFeature(<Invoices />, "Invoices", "Create and manage professional invoices for your practice.")} />
            <Route path="/invoices/new" element={proFeature(<CreateInvoice />, "Invoices", "Create and manage professional invoices for your practice.")} />
            <Route path="/fee-ledger" element={proFeature(<FeeLedger />, "Fee Ledger", "Track received fees and outstanding payments.")} />
            <Route path="/templates" element={protect(<Templates />)} />
            {/* Team handles a pending invite for Free users as well, so an
                invited colleague can accept before they inherit the plan. */}
            <Route path="/team" element={protect(<Team />)} />
            <Route path="/calendar" element={teamFeature(<Calendar />, "Shared calendar", "Coordinate hearings and matters across your chambers.")} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
