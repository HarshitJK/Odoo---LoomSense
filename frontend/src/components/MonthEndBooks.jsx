import { useState } from "react";
import useApi from "../hooks/useApi.js";
import ApiErrorBanner from "./common/ApiErrorBanner.jsx";
import Button from "./common/Button.jsx";
import Disclosure from "./common/Disclosure.jsx";
import FormField, { Input } from "./common/FormField.jsx";
import KpiCard from "./common/KpiCard.jsx";
import LoadingBlock from "./common/LoadingBlock.jsx";
import Notice from "./common/Notice.jsx";
import { Table, THead, Th, TBody, Tr, Td } from "./common/Table.jsx";
import { formatCurrency as money } from "../utils/formatCurrency.js";
import { marginClass } from "../utils/calculations.js";
import { formatMonth, formatPercent } from "../utils/format.js";

// Behind a click on the dashboard: money in, costs and order results for one month.
export default function MonthEndBooks() {
  const [month, setMonth] = useState("");
  const { data: r, error, loading, reload } = useApi(`/api/finance/month-end${month ? `?month=${month}` : ""}`);

  const lines = r && [
    ["Cash received from buyers", r.buyerPaymentsReceived],
    ["Raw material bills", r.rawMaterialBills],
    ["Worker wages", r.workerWages],
    ["Machine running cost", r.machineOperatingCost],
    ["Rework", r.reworkCost],
    ["Other expenses", r.otherExpenses],
  ];

  return (
    <Disclosure title="Month-end books: cash and incurred costs">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Month">
            <Input
              type="month"
              required
              value={month || r?.month || ""}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="sm:w-48"
            />
          </FormField>
          <Button onClick={reload}>Refresh</Button>
        </div>

        <ApiErrorBanner error={error} onRetry={reload} />
        {loading && <LoadingBlock label="Loading the month-end report" />}

        {r && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard title="Money received" value={money(r.totalCashIn)} subtitle={formatMonth(r.month)} />
              <KpiCard title="Costs" value={money(r.totalExpenses)} />
              <KpiCard
                title="Result"
                value={money(r.netCashResult)}
                valueClassName={r.netCashResult >= 0 ? "text-green-700" : "text-red-700"}
              />
            </div>

            <Notice tone={r.netCashResult >= 0 ? "success" : "warning"}>
              {r.netCashResult >= 0
                ? "Payments from buyers covered this month's costs."
                : "This month's costs were higher than payments from buyers."}
            </Notice>

            <ul className="divide-y divide-gray-200 border-y border-gray-200">
              {lines.map(([label, value]) => (
                <li key={label} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="text-gray-900">{label}</span>
                  <span className="tabular-nums text-gray-900">{money(value)}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-md border border-gray-200">
              <Table caption="Orders active this month">
                <THead>
                  <Th>Order</Th>
                  <Th align="right">Earned revenue</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Profit</Th>
                  <Th align="right">Margin</Th>
                </THead>
                <TBody>
                  {[...r.orderProfitability]
                    .sort((a, b) => Number(a.provisional) - Number(b.provisional) || a.margin - b.margin)
                    .map((o) => (
                      <Tr key={o.orderId}>
                        <Td header>{o.orderId}{o.provisional && <span className="block text-xs font-normal text-gray-500">In progress</span>}</Td>
                        <Td align="right">{money(o.earnedRevenue ?? o.revenue)}</Td>
                        <Td align="right">{money(o.totalCost)}</Td>
                        <Td align="right">{money(o.profit)}</Td>
                        <Td align="right" className={o.provisional ? "text-gray-500" : `font-medium ${marginClass(o.margin)}`}>
                          {formatPercent(o.margin)}
                        </Td>
                      </Tr>
                    ))}
                </TBody>
              </Table>
              {r.orderProfitability.length === 0 && (
                <p className="px-4 py-4 text-sm text-gray-600">No order activity in this month.</p>
              )}
            </div>
          </>
        )}
      </div>
    </Disclosure>
  );
}
