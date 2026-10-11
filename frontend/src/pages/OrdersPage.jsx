import { useState } from "react";
import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import Button from "../components/common/Button.jsx";
import Card from "../components/common/Card.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import FormField, { Input, Select } from "../components/common/FormField.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import Notice from "../components/common/Notice.jsx";
import StatusBadge from "../components/common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../components/common/Table.jsx";
import ReadinessResult from "../components/orders/ReadinessResult.jsx";
import BuyerLink from "../components/orders/BuyerLink.jsx";
import ProductionJourney from "../components/orders/ProductionJourney.jsx";
import ProductionControls from "../components/orders/ProductionControls.jsx";
import MachineHistory from "../components/orders/MachineHistory.jsx";
import useApi from "../hooks/useApi.js";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency as money } from "../utils/formatCurrency.js";
import { formatDate, formatMetres, formatPercent } from "../utils/format.js";
import { ORDER_STAGE_CODES, statusLabel } from "../utils/labels.js";

const blank = { buyerName: "", fabricType: "Cotton", colour: "Navy Blue", quantityMeters: 2000, revenue: 350000, deadline: "" };
const COST_LINES = [["rawMaterial", "Raw material"], ["labour", "Labour"], ["machine", "Machines"], ["rework", "Rework and quality loss"], ["other", "Other"]];

// Newest order first: ORD109 before ORD99
const orderNumber = (o) => Number(String(o.orderId).replace(/\D/g, "")) || 0;
const newestFirst = (a, b) => orderNumber(b) - orderNumber(a);

export default function OrdersPage() {
  const { user } = useAuth();
  const orders = useApi("/api/orders");
  const machines = useApi("/api/machines");
  const batches = useApi("/api/inventory");

  const [form, setForm] = useState(null); // the "New order" form
  const [readiness, setReadiness] = useState(null);
  const [panel, setPanel] = useState(null); // { order, mode: "link" | "details" }
  const [cost, setCost] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState("");
  const [reserveKg, setReserveKg] = useState("");
  const [machine, setMachine] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString("en-CA"));

  const rows = [...(orders.data ?? [])].sort(newestFirst);
  const limiter = useRowLimit(rows, 5);
  const selected = panel?.order;

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.response?.data?.detail || "That did not work. Check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  const openForm = () => {
    setForm({ ...blank });
    setPanel(null);
    setReadiness(null);
    setError("");
    setSaved(false);
  };

  const check = () =>
    run(async () => {
      const r = await client.post("/api/orders/readiness-check", {
        ...form,
        expectedRevenue: Number(form.revenue),
        quantityMeters: Number(form.quantityMeters),
      });
      setReadiness(r.data);
    });

  const create = () =>
    run(async () => {
      await client.post("/api/orders", { ...form, quantityMeters: Number(form.quantityMeters), revenue: Number(form.revenue) });
      setForm(null);
      setReadiness(null);
      setSaved(true);
      orders.reload();
    });

  const openLink = (order) => {
    setPanel({ order, mode: "link" });
    setForm(null);
    setError("");
  };

  const openDetails = (order) =>
    run(async () => {
      setPanel({ order, mode: "details" });
      setCost(null);
      setReadiness(null);
      setForm(null);
      const r = await client.get(`/api/orders/${order.orderId}/readiness`);
      setReadiness(r.data);
      if (user.role === "OWNER") setCost((await client.get(`/api/orders/${order.orderId}/cost`)).data);
    });

  const updateSelected = (order) => {
    setPanel((p) => ({ ...p, order }));
    orders.reload();
    machines.reload();
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm({ ...form, [key]: e.target.value });
      setReadiness(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Your orders, and a private link for each buyer."
        action={!form && <Button variant="primary" onClick={openForm}>New order</Button>}
      />

      <ApiErrorBanner error={orders.error} onRetry={orders.reload} />
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="success">Saved. The new order is at the top of the list.</Notice>}

      {form && (
        <Card title="New order">
          <form
            className="mt-3 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Buyer" required><Input required {...field("buyerName")} /></FormField>
              <FormField label="Fabric" required><Input required {...field("fabricType")} /></FormField>
              <FormField label="Colour" required><Input required {...field("colour")} /></FormField>
              <FormField label="Quantity (metres)" required><Input required type="number" min="1" {...field("quantityMeters")} /></FormField>
              <FormField label="Expected revenue (₹)" required><Input required type="number" min="0" {...field("revenue")} /></FormField>
              <FormField label="Deadline" required><Input required type="date" {...field("deadline")} /></FormField>
            </div>

            {readiness && <ReadinessResult result={readiness} />}

            <div className="flex flex-wrap gap-3">
              {readiness ? (
                <Button variant="primary" disabled={busy} onClick={create}>Create order</Button>
              ) : (
                <Button type="submit" variant="primary" disabled={busy}>{busy ? "Checking" : "Check stock and profit"}</Button>
              )}
              <Button onClick={() => { setForm(null); setReadiness(null); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {orders.loading && !orders.data && <LoadingBlock label="Loading orders" height="h-40" />}
      {orders.data?.length === 0 && <EmptyState>No orders yet. Use New order to add the first one.</EmptyState>}

      {orders.data?.length > 0 && (
        <Card title="All orders" padded={false}>
          <Table caption="Orders">
            <THead>
              <Th>Order</Th>
              <Th>Buyer</Th>
              <Th>Fabric and colour</Th>
              <Th align="right">Quantity</Th>
              <Th>Status</Th>
              <Th>Deadline</Th>
              <Th hidden>Actions</Th>
            </THead>
            <TBody>
              {limiter.visible.map((o) => (
                <Tr key={o.orderId}>
                  <Td header>{o.orderId}</Td>
                  <Td>{o.buyerName}</Td>
                  <Td>{[o.fabricType, o.colour].filter(Boolean).join(", ")}</Td>
                  <Td align="right">{formatMetres(o.quantityMeters)}</Td>
                  <Td>
                    <StatusBadge status={o.status !== "CANCELLED" && o.stageStatus === "PAUSED" ? "PAUSED" : o.status} />
                  </Td>
                  <Td>{formatDate(o.deadline, "No deadline")}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button onClick={() => openLink(o)}>Buyer link</Button>
                      <Button disabled={busy} onClick={() => openDetails(o)}>Details</Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <ShowAll limiter={limiter} noun="orders" />
        </Card>
      )}

      {selected && panel.mode === "link" && (
        <Card
          title={`Buyer link for ${selected.orderId}`}
          action={<Button onClick={() => setPanel(null)}>Close</Button>}
        >
          <div className="mt-3">
            <BuyerLink order={selected} onChange={updateSelected} />
          </div>
        </Card>
      )}

      {selected && panel.mode === "details" && (
        <Card
          title={`${selected.orderId} details`}
          action={<Button onClick={() => { setPanel(null); setReadiness(null); }}>Close</Button>}
        >
          <div className="mt-4 space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Can we start this order?</h3>
              <ReadinessResult result={readiness} />
            </section>

            <ProductionControls key={`controls-${selected.orderId}`} order={selected} onChanged={updateSelected} />

            <ProductionJourney key={selected.orderId} order={selected} onChanged={updateSelected} />

            <MachineHistory key={`history-${selected.orderId}`} order={selected} />

            <fieldset disabled={selected.status === "CANCELLED"} className="contents">
            {!selected.gated && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Order stage</h3>
              <FormField label="Stage">
                <Select
                  className="sm:w-64"
                  value={selected.status}
                  disabled={busy}
                  onChange={(e) =>
                    run(async () => {
                      const r = await client.patch(`/api/orders/${selected.orderId}`, { status: e.target.value });
                      updateSelected(r.data);
                    })
                  }
                >
                  {[...new Set([selected.status, ...ORDER_STAGE_CODES])].map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </Select>
              </FormField>
            </section>
            )}

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await client.post(`/api/orders/${selected.orderId}/reserve`, { batchId: batch, quantityKg: Number(reserveKg) });
                  batches.reload();
                  setReserveKg("");
                  setReadiness((await client.get(`/api/orders/${selected.orderId}/readiness`)).data);
                });
              }}
            >
              <h3 className="text-sm font-semibold text-gray-900">Set aside yarn</h3>
              <div className="flex flex-wrap items-end gap-3">
                <FormField label="Yarn" required>
                  <Select required className="sm:w-72" value={batch} onChange={(e) => setBatch(e.target.value)}>
                    <option value="">Choose yarn</option>
                    {batches.data?.map((b) => (
                      <option key={b.batchId} value={b.batchId}>{b.material}, {b.colour} ({b.quantityKg} kg)</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Quantity (kg)" required>
                  <Input required type="number" min="0.01" step="0.01" className="sm:w-32" value={reserveKg} onChange={(e) => setReserveKg(e.target.value)} />
                </FormField>
                <Button type="submit" disabled={busy}>Set aside</Button>
              </div>
            </form>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await client.patch(`/api/machines/${machine}`, { currentOrderId: selected.orderId, status: "RUNNING", productionRate: 100 });
                  machines.reload();
                  orders.reload();
                });
              }}
            >
              <h3 className="text-sm font-semibold text-gray-900">Start on a machine</h3>
              <div className="flex flex-wrap items-end gap-3">
                <FormField label="Idle machine" required>
                  <Select required className="sm:w-72" value={machine} onChange={(e) => setMachine(e.target.value)}>
                    <option value="">Choose a machine</option>
                    {machines.data?.filter((m) => m.status === "IDLE").map((m) => (
                      <option key={m.machineId} value={m.machineId}>{m.name}</option>
                    ))}
                  </Select>
                </FormField>
                <Button type="submit" disabled={busy || selected.stageStatus === "PAUSED"}>Assign and start</Button>
              </div>
              {selected.stageStatus === "PAUSED" && <p className="text-sm text-gray-600">The order is paused. Use Resume production or Change machine above.</p>}
            </form>
            </fieldset>

            {cost && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Cost so far</h3>
                <ul className="divide-y divide-gray-200 border-y border-gray-200">
                  {COST_LINES.map(([key, label]) => (
                    <li key={key} className="flex justify-between gap-3 py-2 text-sm">
                      <span>{label}</span>
                      <span className="tabular-nums">{money(cost.costs[key])}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-900">
                  Total cost {money(cost.totalCost)}. Profit {money(selected.revenue - cost.totalCost)}, margin{" "}
                  {selected.revenue ? formatPercent(((selected.revenue - cost.totalCost) / selected.revenue) * 100) : formatPercent(0)}.
                </p>
              </section>
            )}

            {user.role === "OWNER" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await client.post("/api/transactions", { orderId: selected.orderId, amount: Number(payment), date: paymentDate });
                    setPayment("");
                    orders.reload();
                    updateSelected((await client.get(`/api/orders/${selected.orderId}`)).data);
                  });
                }}
              >
                <h3 className="text-sm font-semibold text-gray-900">Payment from buyer</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <FormField label="Amount received (₹)" required>
                    <Input required type="number" min="0.01" step="0.01" className="sm:w-48" value={payment} onChange={(e) => setPayment(e.target.value)} />
                  </FormField>
                  <FormField label="Date received" required>
                    <Input required type="date" className="sm:w-44" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </FormField>
                  <Button type="submit" disabled={busy}>Record payment</Button>
                </div>
                <p className="text-sm text-gray-600">
                  Received {money(selected.paidAmount || 0)}. Still to receive {money(Math.max(0, selected.revenue - (selected.paidAmount || 0)))}.
                </p>
              </form>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
