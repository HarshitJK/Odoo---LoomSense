import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MainLayout from "./components/layout/MainLayout.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import ProductionPage from "./pages/ProductionPage.jsx";
import WorkersPage from "./pages/WorkersPage.jsx";
import QualityPage from "./pages/QualityPage.jsx";
import FabricPassportPage from "./pages/FabricPassportPage.jsx";
import BuyerTrackingPage from "./pages/BuyerTrackingPage.jsx";
import ScannerPage from "./pages/ScannerPage.jsx";

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Standalone pages (no sidebar) so they work as shareable links */}
      <Route path="/passport/:rollId" element={<FabricPassportPage />} />
      <Route path="/track" element={<BuyerTrackingPage />} />
      <Route path="/track/:trackingToken" element={<BuyerTrackingPage />} />
      <Route path="/scan" element={<ScannerPage />} />

      {/* Internal pages inside the main layout */}
      <Route element={<ProtectedRoute />}><Route element={<MainLayout />}>
        <Route element={<ProtectedRoute roles={["OWNER"]} />}>
        <Route path="/" element={<OwnerDashboard />} />
        </Route><Route element={<ProtectedRoute roles={["OWNER", "PRODUCTION_MANAGER"]} />}><Route path="/orders" element={<OrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/production" element={<ProductionPage />} />
        </Route><Route element={<ProtectedRoute roles={["OWNER"]} />}><Route path="/workers" element={<WorkersPage />} />
        </Route><Route path="/quality" element={<QualityPage />} />
      </Route></Route>
    </Routes></AuthProvider>
  );
}
