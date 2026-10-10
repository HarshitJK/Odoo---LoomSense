import { useParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader.jsx";

export default function BuyerTrackingPage() {
  const { orderId } = useParams();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader title="Track Your Order" subtitle={`Order: ${orderId}`} />
    </div>
  );
}
