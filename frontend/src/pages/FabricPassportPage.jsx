import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import useApi from "../hooks/useApi.js";
import { normalisePassport } from "../api/passport.js";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import Card from "../components/common/Card.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import Notice from "../components/common/Notice.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import PublicPage from "../components/common/PublicPage.jsx";
import PublicBack from "../components/common/PublicBack.jsx";
import StatusBadge from "../components/common/StatusBadge.jsx";

// Only used when VITE_USE_MOCKS=true
import { getRollById as getRollFromMock } from "../mocks/quality.js";

import { formatDateTime } from "../utils/format.js";
import { defectsText, shiftLabel } from "../utils/labels.js";

function Row({ label, children }) {
  if (children == null || children === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3 last:border-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-right text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default function FabricPassportPage() {
  const { rollId } = useParams();

  // Public endpoint: GET /api/passport/{rollId} (passport fields only, no costs)
  const { data: roll, loading, error, reload } = useApi(`/api/passport/${encodeURIComponent(rollId)}`, {
    transform: normalisePassport,
    mock: () => getRollFromMock(rollId),
  });
  const notFound = error?.status === 404 || (!loading && !error && !roll);

  if (loading) {
    return (
      <PublicPage action={<PublicBack />}>
        <LoadingBlock label="Loading the fabric passport" height="h-40" />
      </PublicPage>
    );
  }

  // The server is unreachable or failed (not a 404): show the error, not "not found"
  if (error && !notFound) {
    return (
      <PublicPage action={<PublicBack />}>
        <ApiErrorBanner error={error} onRetry={reload} />
      </PublicPage>
    );
  }

  if (notFound || !roll) {
    return (
      <PublicPage action={<PublicBack />}>
        <Notice tone="error">We could not find roll {rollId}. Check the code and scan it again.</Notice>
      </PublicPage>
    );
  }

  // The QR code opens this page
  const qrUrl =
    typeof window !== "undefined" ? `${window.location.origin}/passport/${roll.rollId}` : `/passport/${roll.rollId}`;

  return (
    <PublicPage action={<PublicBack />}>
      <PageHeader title="Fabric passport" subtitle={`Where roll ${roll.rollId} came from.`} />
      <MockBadge />

      <Card>
        <dl>
          <Row label="Roll">{roll.rollId}</Row>
          <Row label="Order">{roll.orderId}</Row>
          <Row label="Buyer">{roll.buyer}</Row>
          <Row label="Yarn batch">{roll.yarnBatch}</Row>
          <Row label="Machine">{roll.machineId}</Row>
          {roll.shift && <Row label="Shift">{shiftLabel(roll.shift)}</Row>}
          {roll.producedAt && <Row label="Date">{formatDateTime(roll.producedAt)}</Row>}
          <Row label="Result">
            {roll.final ? <StatusBadge status={roll.status} /> : <StatusBadge label="Pending final inspection" tone="warn" />}
          </Row>
          {roll.final && <Row label="Defects">{defectsText(roll.defects)}</Row>}
        </dl>
      </Card>

      <Card title="QR code">
        <div className="mt-3 flex justify-center">
          <QRCodeSVG value={qrUrl} size={200} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" aria-label={`QR code for roll ${roll.rollId}`} />
        </div>
      </Card>
    </PublicPage>
  );
}
