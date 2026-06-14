import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicLayoutWrapper from '@/components/layout/PublicLayoutWrapper';

// Public Pages
import Home from '@/app/page';
import Login from '@/app/login/page';

import GpaCalculator from '@/app/calculator/gpa/page';
import CgpaCalculator from '@/app/calculator/cgpa/page';

// Dashboard Layout
import DashboardLayout from '@/app/dashboard/layout';

// Dashboard Pages
import DashboardHome from '@/app/dashboard/page';
import DashboardGpa from '@/app/dashboard/gpa/page';
import DashboardCgpa from '@/app/dashboard/cgpa/page';
import DashboardHistory from '@/app/dashboard/history/page';
import DashboardDepartments from '@/app/dashboard/departments/page';
import DashboardStaff from '@/app/dashboard/staff/page';
import DashboardSubjects from '@/app/dashboard/subjects/page';
import DashboardOcr from '@/app/dashboard/ocr/page';
import DashboardBulkGpa from '@/app/dashboard/bulk/gpa/page';
import DashboardBulkGpaBatches from '@/app/dashboard/bulk/gpa/batches/page';
import DashboardBulkCgpa from '@/app/dashboard/bulk/cgpa/page';

export default function App() {
  return (
    <BrowserRouter>
      <PublicLayoutWrapper>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          <Route path="/calculator/gpa" element={<GpaCalculator />} />
          <Route path="/calculator/cgpa" element={<CgpaCalculator />} />

          {/* Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout children={undefined} />}>
            <Route index element={<DashboardHome />} />
            <Route path="gpa" element={<DashboardGpa />} />
            <Route path="cgpa" element={<DashboardCgpa />} />
            <Route path="history" element={<DashboardHistory />} />
            <Route path="departments" element={<DashboardDepartments />} />
            <Route path="staff" element={<DashboardStaff />} />
            <Route path="subjects" element={<DashboardSubjects />} />
            <Route path="ocr" element={<DashboardOcr />} />
            <Route path="bulk/gpa" element={<DashboardBulkGpa />} />
            <Route path="bulk/gpa/batches" element={<DashboardBulkGpaBatches />} />
            <Route path="bulk/cgpa" element={<DashboardBulkCgpa />} />
          </Route>
        </Routes>
      </PublicLayoutWrapper>
    </BrowserRouter>
  );
}
