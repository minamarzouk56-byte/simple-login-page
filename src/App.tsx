import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/components/theme-provider";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Journal from "./pages/Journal";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<ProtectedRoute requirePermission="dashboard.view"><Dashboard /></ProtectedRoute>} />
              <Route path="/accounts" element={<ProtectedRoute requirePermission="accounts.view"><Accounts /></ProtectedRoute>} />
              <Route path="/journal" element={<ProtectedRoute requirePermission="journal.view"><Journal /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute requirePermission="partners.view"><Customers /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute requirePermission="partners.view"><Suppliers /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requirePermission="reports.view"><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requirePermission="users.manage"><Users /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
