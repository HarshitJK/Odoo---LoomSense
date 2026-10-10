# Frontend content audit

Checklist for the plain-business-app redesign. Each item is marked **keep**, **behind a click** (moved into a row, button, panel or collapsed section) or **cut** (removed from the screen). Data fetching and state were never removed, only what is displayed.

Limits used: at most 4 summary figures, at most 6 data columns, lists show 5 rows then "Show all", one chart per section and two per page.

## Style audit (before the redesign)

| Finding | Where | Action |
|---|---|---|
| Emoji and pictographs (trophy, warning sign, check mark, up/down triangles) | `OwnerDashboard.jsx` highlight cards and trend line, `mocks/inventory.js` comment | Removed |
| Icon tiles (coloured square holding an icon beside a figure) | Dashboard KPI cards, Stock summary cards, Workers KPI cards, Machines summary strip, machine detail rows, quality form headers | Removed, figures use plain label and value |
| Large shadows, blur | `MachineDetailPanel` (`backdrop-blur-sm`, `shadow-2xl`), chart tooltips (`shadow-lg`) | Removed, border only |
| `rounded-2xl` and pill cards | Passport, Buyer tracking, Scanner, Login, chart cards, all badges (`rounded-full`) | `rounded-md` everywhere |
| Multi-colour palette (violet, purple, indigo, emerald, orange, teal) | Dashboard cost cards, Workers shift badges, Labour cost cards, Quality form, Passport | One accent (blue-700) and muted status colours only |
| Donut chart | `CostBreakdownChart` | Replaced by a horizontal bar list |
| Duplicate components | 3 `StatusBadge`, 3 `ProgressBar`, 3 `KpiCard`/`SummaryCard`/`SmallCostCard` | One each in `components/common` |
| Raw codes on screen | `MATERIAL_READY`, `CANNOT_START_FULL_PRODUCTION`, `IN_PROGRESS`, `READY_FOR_DISPATCH`, `NOT_DISPATCHED`, `PRODUCTION_MANAGER`, `PAID`, `NONE` | Mapped in `utils/labels.js` |
| Raw ISO text | Month-end, purchases (`purchaseDate`), orders (`deadline.slice(0,10)`), quality producedAt | `utils/format.js` friendly dates |
| Database/internal ids on screen | Batch ids, supplier, worker ids, `WorkerID - Name` options, machine ids in quality form, endpoint paths and HTTP status in error banner | Removed or replaced by names (roll, order and machine ids that people use on the floor are kept) |

## Dashboard (owner)

Main question: is the factory making money, and which order is losing it?

| Item | Decision |
|---|---|
| Title "Owner Control Center", subtitle with month | **Keep** as "Dashboard" with a one-line purpose |
| Four figures: Revenue, Total cost, Net profit, Profit margin | **Keep** (renamed from "Receipts less Incurred Costs" and "Receipts Surplus %") |
| "vs last month" trend lines on the figures | **Cut** |
| Four small cost cards (raw material, labour, machine, rework) | **Cut**, replaced by the cost breakdown list below |
| Revenue / cost / profit bar chart | **Keep** one chart: revenue against cost by month (profit series cut, the table shows profit) |
| Cost breakdown donut chart | **Cut**, replaced by a bar list (same data) |
| Order profit table: 6 columns incl. total cost | **Keep** 5 columns (Order, Buyer, Revenue, Profit, Margin), lowest margin first, 5 rows then Show all. Total cost column **cut** (revenue minus profit) |
| Margin pill with coloured background | **Keep** as coloured margin text only |
| Most/least profitable order cards | **Cut** (the sorted table shows both ends) |
| Profit leakage panel: expected/actual boxes, breakdown, total, recommendation | **Keep** as "Where profit was lost": order, margin line, causes with amounts, one recommendation. Total box **cut** |
| Month-end / close books (3 figures, two lists, machine output, wage summary, order table) | **Behind a click** ("Month-end report"). Inside: 3 figures, money in and costs list, order table (5 columns). Machine output table, production overview, wage summary and the accounting-basis paragraph **cut** |
| "Using mock data" badge | **Keep** (only visible with `VITE_USE_MOCKS=true`) |

## Orders (manager)

Main question: what orders do we have, and how do I send the buyer a link?

| Item | Decision |
|---|---|
| Table columns (8: order/buyer, fabric/colour, produced/required, status/deadline, revenue, progress, readiness, action) | **Keep** 6: Order, Buyer, Fabric and colour, Quantity, Status, Deadline. Revenue, progress bar and per-row readiness **cut** from the table (readiness is behind Details) |
| Rows | Newest first, 5 rows then Show all |
| "Buyer link" per row | **Keep**: opens copy / open / regenerate (regenerate asks for confirmation in a dialog) |
| Details per row (readiness, true cost, reserve material, assign machine, change stage, record payment) | **Behind a click** ("Details" panel under the table) |
| "Create Order" form: 6 fields, readiness check then "Accept and create" | **Keep** the same two steps, only required fields, opened by "New order" |
| Readiness result: 3 figure boxes, 6 cost lines, margin, warnings | **Keep** one sentence, required/available kg, expected profit and margin, one warning line (shared with Stock) |

## Stock (manager)

Main question: do we have enough yarn, and can we start this order?

| Item | Decision |
|---|---|
| Three summary cards (total stock, stock value, low stock batches) | **Keep** 3 plain figures |
| Table (8 columns incl. batch id, batch value, supplier) | **Keep** 5: Material, Colour, Quantity (kg), Cost per kg, status. Batch id, batch value, supplier **cut** from the screen. "In stock" text **cut**, only "Low stock" badge shown. Low stock rows first, 5 rows then Show all |
| Purchase register (owner): form with 11 fields and a bills table | **Behind a click**: "Receive material" button opens a form with required fields only; batch, other charges, notes and the "receive into inventory" tick sit under "More options". Bills table is in a collapsed "Supplier bills" section |
| Readiness checker | **Keep** as "Can we start this order?": 4 inputs; result leads with "Material ready" or "Not enough material: N kg short", then required kg, available kg, expected profit and margin, and one warning line only below target. Projected cost lines (material, labour, machine, total) **cut** |

## Machines (manager)

Main question: which machines are running, and how far along are they?

| Item | Decision |
|---|---|
| Four tiles (running, idle, down, total metres today) | **Keep** one summary line: running, idle, down. Total metres **cut** |
| Live / Reconnecting indicator | **Keep** as small text |
| "Simulator running at 1x" | **Cut** |
| Latest factory event message | **Keep** as one information line |
| Card: id, name, badge, order, progress bar, rate, efficiency, temperature, est. completion, live cost box (cost per hour, cost so far, cost per metre) | **Keep** id and status, order, metres done of target with progress bar, cost so far. Name, rate, efficiency, temperature, estimated finish, cost per hour, cost per metre **behind a click** (detail panel) |
| Detail panel | **Keep** with plain rows: order, progress, rate, efficiency, temperature, runtime today, estimated finish, cost per hour, cost so far, cost per metre. "Production today" blue box **cut** (same as progress) |

## Workers

Main question: how many hours did people work and what does it cost? Log hours quickly.

| Item | Decision |
|---|---|
| Three KPI cards | **Keep** 3 figures (regular wages, overtime pay, total labour cost); the long notes **cut** |
| Workforce insight banner | **Cut** (profit loss is on the Dashboard). The data request stays so the refresh after saving hours is unchanged |
| Labour cost per order: 3 cards each with a monospaced line, three mini figures and a "Highest cost" badge | **Keep** as a small table: Order, Workers, Hours, Cost (5 rows then Show all) |
| Hours form: worker, order, machine, hours, overtime, date | **Keep** worker, order, hours, overtime and date (date shown and editable). Machine is **cut** from the screen and set to the worker's latest machine, else the first machine |
| Worker table (9 columns incl. worker id, hourly rate, order) | **Keep** 6: Worker, Shift, Machine, Hours, Overtime, Wage. Worker id, hourly rate and order **cut**. 5 rows then Show all |
| Form placement | First on phones (above the figures) |

## Quality checks

Main question: record this roll's result, then see recent rolls.

| Item | Decision |
|---|---|
| "Scan a roll QR" button | **Keep** as secondary button |
| Form fields: roll id, order, machine, yarn batch, status, defects, affected metres | **Keep** Roll (optional, blank = automatic), Order, Result (three large choices), defect checkboxes and affected metres only for Failed or Rework. Machine and yarn batch **cut** from the screen and still filled from the chosen order as before |
| Cost impact card (4 boxes, total, margin before and after, badge) | **Keep** one result box "Extra cost ... Order margin falls from X to Y" with the three cost parts (labour, machine, material) listed under it. Affected fabric box and badge **cut** |
| Rolls table (8 columns) | **Keep** 4: Roll, Order, Result, Passport link. Machine, yarn batch, shift, defects **cut** from the list (all on the passport). Newest first, 5 rows then Show all |

## Fabric passport (public)

| Item | Decision |
|---|---|
| Brand header, shield icon, "Fabric Digital Passport" | **Keep** wordmark and title |
| QR code with caption "Scan to verify..." | **Keep** QR code, caption **cut** |
| Details: roll id, order, buyer, yarn batch, machine, shift, date, defects, rework status | **Keep** all but rework status (**cut**), plus the result (badge) |
| "Verified Traceability" seal, "Back to Factory QC" link | **Cut** (public page has no internal navigation) |
| Not found state with link to /quality | **Keep** message, internal link **cut** |

## Buyer tracking (public link)

| Item | Decision |
|---|---|
| "Live Order Status" eyebrow, order number as large heading | **Cut** order number and eyebrow; heading is the buyer's name |
| Two status badges (dispatch, quality) | **Keep** as plain rows: Quality, Dispatch |
| Fabric/colour, quantity | **Keep** |
| Progress bar | **Keep** one bar with a percentage |
| Expected completion | **Keep**, friendly date |
| Timeline with "Completed and verified / Upcoming stage" captions and pulse animation | **Keep** timeline (filled dot, ring, empty ring), captions and animation **cut** |
| "LoomSense Buyer Transparency" footer | **Cut** |

## Scan QR code

| Item | Decision |
|---|---|
| Camera area, start/stop button | **Keep**, one large camera area and one button |
| Upload a photo, type a code | **Keep** as two smaller options |
| Header text, subtitle, "Dashboard" link | **Keep** title and one-line purpose, link renamed "Back to app" |

## Login

Restyled with the shared form components. Content unchanged except "Sign in to factory operations" which stays as the one-line purpose.
