import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const protect = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
