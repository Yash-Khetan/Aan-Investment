import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./features/landing/LandingPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { AccountingPage } from "./features/accounting/AccountingPage";
import { CollateralPage } from "./features/collateral/CollateralPage";
import { CollectionsPage } from "./features/collections/CollectionsPage";
import { DocumentsPage } from "./features/documents/DocumentsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/collateral" element={<CollateralPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
      </Route>
    </Routes>
  );
}
