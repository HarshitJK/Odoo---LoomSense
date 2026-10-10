import { Link } from "react-router-dom";
import Card from "../common/Card.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../common/Table.jsx";

/** Recent rolls, newest first, each with a link to its public fabric passport. */
export default function RollsTable({ rolls = [] }) {
  const sorted = [...rolls].sort((a, b) => String(b.producedAt ?? "").localeCompare(String(a.producedAt ?? "")));
  const limiter = useRowLimit(sorted, 5);
  return (
    <Card title="Recent rolls" padded={false}>
      <Table caption="Recent rolls">
        <THead>
          <Th>Roll</Th>
          <Th>Order</Th>
          <Th>Result</Th>
          <Th hidden>Passport</Th>
        </THead>
        <TBody>
          {limiter.visible.map((roll) => (
            <Tr key={roll.rollId}>
              <Td header>{roll.rollId}</Td>
              <Td>{roll.orderId}</Td>
              <Td><StatusBadge status={roll.status} /></Td>
              <Td align="right">
                <Link to={`/passport/${roll.rollId}`} className="text-blue-700 hover:underline" aria-label={`Passport for ${roll.rollId}`}>
                  Passport
                </Link>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="rolls" />
      {rolls.length === 0 && <p className="px-4 py-4 text-sm text-gray-600">No rolls recorded yet. Save the first one above.</p>}
    </Card>
  );
}
