import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";
import { formatMetres } from "../../utils/format.js";
import { inspectionTypeLabel, qcStageLabel } from "../../utils/labels.js";

/**
 * Orders waiting for an inspection (GET /api/quality/pending):
 * a weaving order that reached its sample length, or a stage that was marked complete.
 * onInspect(orderId) fills the inspection form for that order.
 */
export default function PendingInspections({ rows = [], onInspect }) {
  const limiter = useRowLimit(rows, 5);
  return (
    <Card title="Waiting for inspection" padded={false}>
      <Table caption="Orders waiting for an inspection">
        <THead>
          <Th>Order</Th>
          <Th>Stage</Th>
          <Th>Inspection</Th>
          <Th>Machine</Th>
          <Th align="right">Sample</Th>
          <Th hidden>Action</Th>
        </THead>
        <TBody>
          {limiter.visible.map((row) => (
            <Tr key={`${row.orderId}-${row.stage}`}>
              <Td header>{row.orderId}</Td>
              <Td>{qcStageLabel(row.stage)}</Td>
              <Td>{inspectionTypeLabel(row.inspectionType)}</Td>
              <Td>{row.machineId ?? "None"}</Td>
              <Td align="right">{row.sampleMeters ? formatMetres(row.sampleMeters) : "Whole stage"}</Td>
              <Td align="right">
                <Button onClick={() => onInspect(row.orderId)} aria-label={`Inspect ${row.orderId}`}>Inspect</Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="orders" />
    </Card>
  );
}
