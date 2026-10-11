import Card from "../common/Card.jsx";
import { Table, THead, Th, TBody, Tr, Td } from "../common/Table.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatMetres } from "../../utils/format.js";
import { qcStageLabel, reasonLabel } from "../../utils/labels.js";

/**
 * Cancelled orders and what each one lost, kept apart from the completed orders.
 * orders: the cancelledOrders array of GET /api/finance/dashboard (each has a `cancellation` block).
 * Recoverable material is only yarn that was put back in stock; nothing is assumed.
 */
export default function CancelledOrdersTable({ orders }) {
  return (
    <Card title="Cancelled orders" padded={false}>
      <Table caption="Cancelled orders with the cost already incurred and the loss">
        <THead>
          <Th>Order</Th>
          <Th>Buyer</Th>
          <Th>Stopped at</Th>
          <Th align="right">Order value</Th>
          <Th align="right">Cost incurred</Th>
          <Th align="right">Material recovered</Th>
          <Th align="right">Loss</Th>
        </THead>
        <TBody>
          {orders.map((o) => {
            const c = o.cancellation ?? {};
            return (
              <Tr key={o.orderId}>
                <Td header>
                  {o.orderId}
                  <span className="block text-xs font-normal text-gray-500">{reasonLabel(c.reason)}</span>
                </Td>
                <Td>{o.buyerName}</Td>
                <Td>{qcStageLabel(c.stoppedAtStage)}, {formatMetres(c.producedMeters)}</Td>
                <Td align="right">{formatCurrency(c.estimatedOrderValue)}</Td>
                <Td align="right">{formatCurrency(c.actualCostIncurred)}</Td>
                <Td align="right">{formatCurrency(c.recoverableMaterialValue)}</Td>
                <Td align="right" className="font-medium text-red-700">{formatCurrency(c.writeOffLoss)}</Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
