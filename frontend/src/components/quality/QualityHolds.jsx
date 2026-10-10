import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";
import { formatMetres } from "../../utils/format.js";
import { qcStageLabel, severityLabel } from "../../utils/labels.js";

/**
 * Orders on quality hold (GET /api/quality/holds). Production for these orders is stopped until a
 * corrective action is recorded and a reinspection passes. onReinspect(hold) starts that reinspection.
 */
export default function QualityHolds({ rows = [], onReinspect }) {
  const limiter = useRowLimit(rows, 5);
  return (
    <Card title="On quality hold" padded={false}>
      <Table caption="Orders on quality hold">
        <THead>
          <Th>Order</Th>
          <Th>Failed stage</Th>
          <Th>Defect</Th>
          <Th>Severity</Th>
          <Th align="right">Affected</Th>
          <Th hidden>Action</Th>
        </THead>
        <TBody>
          {limiter.visible.map((hold) => (
            <Tr key={hold.orderId}>
              <Td header>{hold.orderId}</Td>
              <Td>{qcStageLabel(hold.failedStage)}</Td>
              <Td>
                {hold.defectType ?? "Not recorded"}
                {hold.needsCorrectiveAction && (
                  <span className="ml-2 align-middle"><StatusBadge label="Action needed" tone="warn" /></span>
                )}
              </Td>
              <Td>{severityLabel(hold.defectSeverity)}</Td>
              <Td align="right">{formatMetres(hold.affectedMeters)}</Td>
              <Td align="right">
                <Button onClick={() => onReinspect(hold)} aria-label={`Reinspect ${hold.orderId}`}>Reinspect</Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="orders" />
    </Card>
  );
}
