import Card from "../common/Card.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatHours } from "../../utils/format.js";

/** rows = labourCostPerOrder from GET /api/workers/wages/summary (calculated by the server). */
export default function LabourCostPerOrder({ rows = [] }) {
  const limiter = useRowLimit(rows, 5);
  return (
    <Card title="Labour cost by order" padded={false}>
      <Table caption="Labour cost by order">
        <THead>
          <Th>Order</Th>
          <Th align="right">Workers</Th>
          <Th align="right">Hours</Th>
          <Th align="right">Cost</Th>
        </THead>
        <TBody>
          {limiter.visible.map((r) => (
            <Tr key={r.orderId}>
              <Td header>{r.orderId}</Td>
              <Td align="right">{r.workersInvolved}</Td>
              <Td align="right">{formatHours(r.labourHours)}</Td>
              <Td align="right">{formatCurrency(r.labourCost)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="orders" />
      {rows.length === 0 && <p className="px-4 py-4 text-sm text-gray-600">No hours logged against orders yet.</p>}
    </Card>
  );
}
