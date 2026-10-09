import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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

const queryClient = new QueryClient();

const protect = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

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
            <Route path="/dashboard" element={protect(<Dashboard />)} />
            <Route path="/cases" element={protect(<Cases />)} />
            <Route path="/cases/new" element={protect(<CreateCase />)} />
            <Route path="/cases/:id" element={protect(<CaseDetail />)} />
            <Route path="/vault" element={protect(<Vault />)} />
            <Route path="/partners" element={protect(<Partners />)} />
            <Route path="/settings/notifications" element={protect(<NotificationSettings />)} />
            <Route path="/profile" element={protect(<Profile />)} />
            <Route path="/invoices" element={protect(<Invoices />)} />
            <Route path="/invoices/new" element={protect(<CreateInvoice />)} />
            <Route path="/fee-ledger" element={protect(<FeeLedger />)} />
            <Route path="/templates" element={protect(<Templates />)} />
            <Route path="/team" element={protect(<Team />)} />
            <Route path="/calendar" element={protect(<Calendar />)} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
