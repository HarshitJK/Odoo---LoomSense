import { useState } from "react";
import client from "../../api/client.js";
import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import FormField, { Input } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";
import ReadinessResult from "./ReadinessResult.jsx";

/**
 * "Can we start this order?" The calculation is done by the server:
 * POST /api/orders/readiness-check with { quantityMeters, colour, fabricType, expectedRevenue }.
 */
export default function OrderReadinessChecker() {
  // Prefilled with the Cotton / Navy Blue / 2000 m demo order
  const [fabricType, setFabricType] = useState("Cotton");
  const [colour, setColour] = useState("Navy Blue");
  const [metres, setMetres] = useState("2000");
  const [revenue, setRevenue] = useState("350000");

  const [result, setResult] = useState(null); // null = not checked yet
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleCheck(e) {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      const res = await client.post("/api/orders/readiness-check", {
        fabricType: fabricType.trim(),
        colour: colour.trim(),
        quantityMeters: parseFloat(metres),
        expectedRevenue: parseFloat(revenue) || 0,
      });
      setResult(res.data);
    } catch (err) {
      setResult(null);
      setError(err?.response?.data?.detail || "Could not check this order. Check the details and try again.");
    } finally {
      setChecking(false);
    }
  }

  const clear = (setter) => (e) => {
    setter(e.target.value);
    setResult(null);
    setError("");
  };

  return (
    <Card title="Can we start this order?">
      <form onSubmit={handleCheck} className="mt-3 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Fabric" required>
            <Input id="input-fabric-type" required value={fabricType} onChange={clear(setFabricType)} />
          </FormField>
          <FormField label="Colour" required>
            <Input id="input-colour" required value={colour} onChange={clear(setColour)} />
          </FormField>
          <FormField label="Quantity (metres)" required>
            <Input id="input-metres" required type="number" min="1" value={metres} onChange={clear(setMetres)} />
          </FormField>
          <FormField label="Expected revenue (₹)" required>
            <Input id="input-revenue" placeholder="350000" required type="number" min="0" value={revenue} onChange={clear(setRevenue)} />
          </FormField>
        </div>

        <Button id="btn-check-readiness" type="submit" variant="primary" disabled={checking}>
          {checking ? "Checking" : "Check this order"}
        </Button>
      </form>

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      {result && (
        <div className="mt-4">
          <ReadinessResult result={result} />
        </div>
      )}
    </Card>
  );
}
