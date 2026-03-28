/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TourListPage from './pages/TourListPage';
import TourDetailPage from './pages/TourDetailPage';
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Button } from './components/ui/button';
import { Calculator } from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/tour/cost-calculator" replace />} />
          <Route path="/tour/cost-calculator" element={<TourListPage />} />
          <Route path="/tour/cost-calculator/:id" element={<TourDetailPage />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
