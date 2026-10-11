import { useEffect, useRef } from "react";
import useApi from "../../hooks/useApi.js";
import ApiErrorBanner from "../common/ApiErrorBanner.jsx";
import LoadingBlock from "../common/LoadingBlock.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td } from "../common/Table.jsx";
import { formatDateTime, formatMetres } from "../../utils/format.js";
import { qcStageLabel, reasonLabel } from "../../utils/labels.js";

/**
 * Every machine session of an order, in order (GET /api/orders/{id}/machine-history).
 * Props: order - the order object. The list reloads whenever the order changes, so an action shows up at once.
 */
export default function MachineHistory({ order }) {
  const history = useApi(`/api/orders/${order.orderId}/machine-history`);
  const seen = useRef(order.updatedAt);
  const { reload } = history;
  useEffect(() => {
    if (seen.current !== order.updatedAt) {
      seen.current = order.updatedAt;
      reload();
    }
  }, [order.updatedAt, reload]);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">Machine history</h3>
      <ApiErrorBanner error={history.error} onRetry={history.reload} />
      {history.loading && !history.data && <LoadingBlock label="Loading machine history" />}
      {history.data?.length === 0 && <p className="text-sm text-gray-600">No machine has worked on this order yet.</p>}
      {history.data?.length > 0 && (
        <div className="rounded-md border border-gray-200">
          <Table caption="Machine sessions">
            <THead>
              <Th>Machine</Th>
              <Th>Stage</Th>
              <Th>Started</Th>
              <Th>Ended</Th>
              <Th align="right">Metres</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
            </THead>
            <TBody>
              {history.data.map((s) => (
                <Tr key={s.sessionId}>
                  <Td header>{s.machineId}</Td>
                  <Td>{qcStageLabel(s.stage)}</Td>
                  <Td>{formatDateTime(s.startedAt)}</Td>
                  <Td>{s.endedAt ? formatDateTime(s.endedAt) : "Current"}</Td>
                  <Td align="right">{formatMetres(s.metresProduced)}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td>{s.endReason ? reasonLabel(s.endReason) : ""}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </section>
  );
}
