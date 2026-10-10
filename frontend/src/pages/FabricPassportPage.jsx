import { useParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader.jsx";

export default function FabricPassportPage() {
  const { rollId } = useParams();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader title="Fabric Digital Passport" subtitle={`Roll: ${rollId}`} />
    </div>
  );
}
