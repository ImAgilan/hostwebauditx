import { BrowserRouter, Routes, Route } from 'react-router-dom';

/* ── Main Module Pages ── */
import Home                    from './Home';
import UIAnalysisHome          from './ui-analysis/Home';
import MobileFriendlinessHome  from './mobile-friendliness/Home';
import AccessibilityHome       from './accessibility/Home';
import SeoHome, { SeoAiInsight } from './seo/Home';
import { PerformanceHome, PerformanceAIInsight } from './performance/Home';
import SecurityHome            from './security/Home';
import ContentQualityHome      from './content-quality/Home';
import StructureNavigationHome from './structure-navigation/Home';
import AuditResults            from './audit-results/AuditResults';
import TechnicalInsightHome    from './technical-insight/Home';

/* ── Auth & User Pages ── */
import AuthPage            from './auth/Auth';
import PaymentPage         from './payment/Payment';
import ForgotPasswordPage  from './forgot-password/ForgotPassword';
import ProfilePage         from './profile/Profile';
import DashboardPage       from './dashboard/Dashboard';
import AuditHistoryPage    from './audit-history/AuditHistory';

/* ── Admin Panel ── */
import AdminLogin  from './admin/AdminLogin';
import AdminRoute  from './admin/components/AdminRoute';
import Dashboard   from './admin/pages/Dashboard';
import Users       from './admin/pages/Users';
import Admins      from './admin/pages/Admins';
import Audits      from './admin/pages/Audits';
import Revenue     from './admin/pages/Revenue';
import Settings    from './admin/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ════════════════════════════════════════
            PUBLIC — Main Homepage
        ════════════════════════════════════════ */}
        <Route path="/" element={<Home />} />

        {/* ── Auth ── */}
        <Route path="/auth"            element={<AuthPage />} />
        <Route path="/login"           element={<AuthPage />} />
        <Route path="/register"        element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ForgotPasswordPage />} />

        {/* ── Payment ── */}
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/pricing" element={<PaymentPage />} />
        <Route path="/upgrade" element={<PaymentPage />} />

        {/* ── User Pages ── */}
        <Route path="/dashboard"     element={<DashboardPage />} />
        <Route path="/profile"       element={<ProfilePage />} />
        <Route path="/settings"      element={<ProfilePage />} />
        <Route path="/audit-history" element={<AuditHistoryPage />} />
        <Route path="/history"       element={<AuditHistoryPage />} />

        {/* ════════════════════════════════════════
            MODULES
        ════════════════════════════════════════ */}

        {/* Module 01: UI/UX Analysis */}
        <Route path="/ui"          element={<UIAnalysisHome />} />
        <Route path="/ui-analysis" element={<UIAnalysisHome />} />

        {/* Module 02: Mobile-Friendliness */}
        <Route path="/mobile-friendliness" element={<MobileFriendlinessHome />} />

        {/* Module 03: Accessibility */}
        <Route path="/accessibility"          element={<AccessibilityHome />} />
        <Route path="/accessibility-analysis" element={<AccessibilityHome />} />

        {/* Module 04: SEO */}
        <Route path="/seo"                element={<SeoHome />} />
        <Route path="/seo-analysis"       element={<SeoHome />} />
        <Route path="/seo/ai-insight/:id" element={<SeoAiInsight />} />

        {/* Module 05: Performance */}
        <Route path="/performance"                element={<PerformanceHome />} />
        <Route path="/performance-analysis"       element={<PerformanceHome />} />
        <Route path="/performance/ai-insight/:id" element={<PerformanceAIInsight />} />

        {/* Module 06: Security */}
        <Route path="/security" element={<SecurityHome />} />

        {/* Module 07: Content Quality */}
        <Route path="/content-quality" element={<ContentQualityHome />} />

        {/* Module 08: Structure & Navigation */}
        <Route path="/structure-navigation" element={<StructureNavigationHome />} />
        <Route path="/structure"            element={<StructureNavigationHome />} />

        {/* Module 09: Technical Insights */}
        <Route path="/technical-insight" element={<TechnicalInsightHome />} />

        {/* Full Audit Results */}
        <Route path="/audit/:id" element={<AuditResults />} />

        {/* ════════════════════════════════════════
            ADMIN PANEL — Protected Routes
        ════════════════════════════════════════ */}

        {/* Login — public */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin"       element={<AdminLogin />} />

        {/* Dashboard — any admin */}
        <Route path="/admin/dashboard" element={
          <AdminRoute><Dashboard /></AdminRoute>
        } />

        {/* Users — requires viewUsers permission */}
        <Route path="/admin/users" element={
          <AdminRoute><Users /></AdminRoute>
        } />

        {/* Audit History — requires viewAudits permission */}
        <Route path="/admin/audits" element={
          <AdminRoute><Audits /></AdminRoute>
        } />

        {/* Revenue — requires viewRevenue permission */}
        <Route path="/admin/revenue" element={
          <AdminRoute><Revenue /></AdminRoute>
        } />

        {/* Settings — any admin */}
        <Route path="/admin/settings" element={
          <AdminRoute><Settings /></AdminRoute>
        } />

        {/* Admin Accounts — super_admin only */}
        <Route path="/admin/admins" element={
          <AdminRoute superAdminOnly><Admins /></AdminRoute>
        } />

        {/* ── Fallback ── */}
        <Route path="*" element={<Home />} />

      </Routes>
    </BrowserRouter>
  );
}