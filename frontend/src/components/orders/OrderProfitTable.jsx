import Card from "../common/Card.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { marginClass } from "../../utils/calculations.js";
import { formatPercent } from "../../utils/format.js";

/**
 * Orders with their profit, lowest margin first. Orders without a result yet go last.
 * orders: array from GET /api/orders
 */
export default function OrderProfitTable({ orders }) {
  const sorted = [...orders].sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity));
  const limiter = useRowLimit(sorted, 5);

  return (
    <Card title="Orders, lowest margin first" padded={false}>
      <Table caption="Orders with revenue, profit and margin">
        <THead>
          <Th>Order</Th>
          <Th>Buyer</Th>
          <Th align="right">Revenue</Th>
          <Th align="right">Profit</Th>
          <Th align="right">Margin</Th>
        </THead>
        <TBody>
          {limiter.visible.map((order) => {
            const hasData = order.profit !== null && order.profit !== undefined;
            return (
              <Tr key={order.orderId}>
                <Td header>{order.orderId}</Td>
                <Td>{order.buyerName}</Td>
                <Td align="right">{formatCurrency(order.revenue)}</Td>
                <Td align="right">{hasData ? formatCurrency(order.profit) : "Pending"}</Td>
                <Td align="right" className={hasData ? `font-medium ${marginClass(order.margin)}` : "text-gray-500"}>
                  {hasData ? formatPercent(order.margin) : "Pending"}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="orders" />
    </Card>
  );
}
