import Card from "../common/Card.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatHours } from "../../utils/format.js";
import { shiftLabel } from "../../utils/labels.js";

/**
 * This month's hours and wages per worker. Rows are GET /api/workers items; hours and wages are the
 * server's monthly figures (hoursThisMonth, overtimeThisMonth, wageThisMonth), not calculated here.
 */
export default function WorkersTable({ workers = [] }) {
  const limiter = useRowLimit(workers, 5);
  return (
    <Card title="Hours and wages this month" padded={false}>
      <Table caption="Workers, hours and wages this month">
        <THead>
          <Th>Worker</Th>
          <Th>Shift</Th>
          <Th>Machine</Th>
          <Th align="right">Hours</Th>
          <Th align="right">Overtime</Th>
          <Th align="right">Wage</Th>
        </THead>
        <TBody>
          {limiter.visible.map((w) => (
            <Tr key={w.workerId}>
              <Td header>{w.name}</Td>
              <Td>{shiftLabel(w.shift)}</Td>
              <Td>{w.latestAssignment?.machineId ?? "None"}</Td>
              <Td align="right">{formatHours(w.hoursThisMonth)}</Td>
              <Td align="right">{formatHours(w.overtimeThisMonth)}</Td>
              <Td align="right">{formatCurrency(w.wageThisMonth)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="workers" />
    </Card>
  );
}
