/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TourListPage from './pages/TourListPage';
import TourDetailPage from './pages/TourDetailPage';
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Button } from './components/ui/button';
import { Calculator } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Calculator className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground font-medium">ກຳລັງໂຫລດ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary mb-4">
              <Calculator className="h-12 w-12" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Tour Cost Calculator</h1>
            <p className="text-muted-foreground">ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເລີ່ມຕົ້ນການຄຳນວນ</p>
          </div>
          <Button onClick={login} size="lg" className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/20">
            ເຂົ້າສູ່ລະບົບດ້ວຍ Google
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/tour/cost-calculator" replace />} />
          <Route path="/tour/cost-calculator" element={
            <ProtectedRoute>
              <TourListPage />
            </ProtectedRoute>
          } />
          <Route path="/tour/cost-calculator/:id" element={
            <ProtectedRoute>
              <TourDetailPage />
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
