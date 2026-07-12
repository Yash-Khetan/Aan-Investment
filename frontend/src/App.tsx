import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./features/landing/LandingPage";
import { LoginPage } from "./features/auth/LoginPage";
import { SignupPage } from "./features/auth/SignupPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { AccountingPage } from "./features/accounting/AccountingPage";
import { CollateralPage } from "./features/collateral/CollateralPage";
import { CollectionsPage } from "./features/collections/CollectionsPage";
import { DocumentsPage } from "./features/documents/DocumentsPage";
import { BorrowersPage } from "./features/borrowers/BorrowersPage";
import { CreateBorrowerPage } from "./features/borrowers/CreateBorrowerPage";
import { EditBorrowerPage } from "./features/borrowers/EditBorrowerPage";
import { LoansPage } from "./features/loans/LoansPage";
import { CreateLoanPage } from "./features/loans/CreateLoanPage";
import { EditLoanPage } from "./features/loans/EditLoanPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/borrowers" element={<BorrowersPage />} />
          <Route path="/borrowers/new" element={<CreateBorrowerPage />} />
          <Route path="/borrowers/:id/edit" element={<EditBorrowerPage />} />
          <Route path="/loans" element={<LoansPage />} />
          <Route path="/loans/new" element={<CreateLoanPage />} />
          <Route path="/loans/:id/edit" element={<EditLoanPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/collateral" element={<CollateralPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
