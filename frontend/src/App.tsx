import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { LandingPage } from "./features/landing/LandingPage";
import { LoginPage } from "./features/auth/LoginPage";
// import { SignupPage } from "./features/auth/SignupPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { DocumentsPage } from "./features/documents/DocumentsPage";
import { BorrowersPage } from "./features/borrowers/BorrowersPage";
import { CreateBorrowerPage } from "./features/borrowers/CreateBorrowerPage";
import { EditBorrowerPage } from "./features/borrowers/EditBorrowerPage";
import { LoansPage } from "./features/loans/LoansPage";
import { LoanPage } from "./features/loans/LoanPage";
import { BorrowerPage } from "./features/borrowers/BorrowerPage";
import { CreateLoanPage } from "./features/loans/CreateLoanPage";
import { EditLoanPage } from "./features/loans/EditLoanPage";
import { UsersPage } from "./features/admin/UsersPage";
import { CreateUserPage } from "./features/admin/CreateUserPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* <Route path="/signup" element={<SignupPage />} /> */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/borrowers" element={<BorrowersPage />} />
          <Route path="/borrowers/new" element={<CreateBorrowerPage />} />
          <Route path="/borrowers/:id" element={<BorrowerPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/loans/new" element={<CreateLoanPage />} />
          <Route path="/loans/:id" element={<LoanPage />} />
          <Route path="/borrowers/:id/edit" element={<EditBorrowerPage />} />
          <Route path="/loans/:id/edit" element={<EditLoanPage />} />
          {/* Importing history happens on the loan's own Imported history tab. */}
          <Route path="/get-kpi" element={<Navigate to="/loans" replace />} />
          {/* A loan's ledger and collateral are tabs on its own page now. */}
          <Route path="/ledger" element={<Navigate to="/loans" replace />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/collateral" element={<Navigate to="/loans" replace />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/users/new" element={<CreateUserPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
