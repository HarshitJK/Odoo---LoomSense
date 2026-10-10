import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import ProductionPage from "./pages/ProductionPage.jsx";
import WorkersPage from "./pages/WorkersPage.jsx";
import QualityPage from "./pages/QualityPage.jsx";
import FabricPassportPage from "./pages/FabricPassportPage.jsx";
import BuyerTrackingPage from "./pages/BuyerTrackingPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* Standalone pages (no sidebar) so they work as shareable links */}
      <Route path="/passport/:rollId" element={<FabricPassportPage />} />
      <Route path="/track/:orderId" element={<BuyerTrackingPage />} />

      {/* Internal pages inside the main layout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<OwnerDashboard />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/quality" element={<QualityPage />} />
      </Route>
    </Routes>
  );
}
