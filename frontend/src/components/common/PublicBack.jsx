import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "./Button.jsx";

export default function PublicBack({ fallback = "/quality", authenticatedOnly = false }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // React Router's index measures in-app history; history.length also counts external sites.
  const hasHistory = (window.history.state?.idx ?? 0) > 0;
  if ((!hasHistory && (!user || loading)) || (authenticatedOnly && !user)) return null;
  return <Button onClick={() => hasHistory ? navigate(-1) : navigate(fallback)}>
    <ArrowLeft size={16} aria-hidden="true" /> Back
  </Button>;
}
