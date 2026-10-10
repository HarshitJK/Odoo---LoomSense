import { lazy, Suspense } from "react";
import LoadingBlock from "./components/common/LoadingBlock.jsx";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
import MainLayout from "./components/layout/MainLayout.jsx";
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard.jsx"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.jsx"));
const InventoryPage = lazy(() => import("./pages/InventoryPage.jsx"));
const ProductionPage = lazy(() => import("./pages/ProductionPage.jsx"));
const WorkersPage = lazy(() => import("./pages/WorkersPage.jsx"));
const QualityPage = lazy(() => import("./pages/QualityPage.jsx"));
const FabricPassportPage = lazy(() => import("./pages/FabricPassportPage.jsx"));
const BuyerTrackingPage = lazy(() => import("./pages/BuyerTrackingPage.jsx"));
const ScannerPage = lazy(() => import("./pages/ScannerPage.jsx"));

export default function App() {
  return (
    <AuthProvider><Suspense fallback={<LoadingBlock label="Loading page" />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Standalone pages (no sidebar) so they work as shareable links */}
      <Route path="/passport/:rollId" element={<FabricPassportPage />} />
      <Route path="/track" element={<BuyerTrackingPage />} />
      <Route path="/track/:token" element={<BuyerTrackingPage />} />
      <Route path="/scan" element={<ScannerPage />} />

      {/* Internal pages inside the main layout */}
      <Route element={<ProtectedRoute />}><Route element={<MainLayout />}>
        <Route element={<ProtectedRoute roles={["OWNER"]} />}>
        <Route path="/" element={<OwnerDashboard />} />
        </Route><Route element={<ProtectedRoute roles={["OWNER", "PRODUCTION_MANAGER"]} />}><Route path="/orders" element={<OrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/production" element={<ProductionPage />} />
        </Route><Route element={<ProtectedRoute roles={["OWNER", "PRODUCTION_MANAGER"]} />}><Route path="/workers" element={<WorkersPage />} />
        </Route><Route path="/quality" element={<QualityPage />} />
      </Route></Route>
    </Routes></Suspense></AuthProvider>
  );
}
