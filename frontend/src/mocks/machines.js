// 6 machines: W01-W06
// Status: 4 RUNNING, 1 IDLE, 1 DOWN (exactly as spec requires)
// IDLE/DOWN machines have orderId: null and productionRate: 0
// W01 is assigned ORD104 (as specified)

export const machines = [
  {
    machineId: "W01",
    name: "Weaving Machine 01",
    status: "RUNNING",
    orderId: "ORD104",      // matches orders.js
    productionRate: 112,    // metres per hour
    producedMeters: 1460,
    targetMeters: 2000,
    temperature: 61,
    efficiency: 0.91,
    costPerHour: 600,
    runtimeHours: 6.5,
    estimatedCompletion: "2026-10-15T16:30:00",
  },
  {
    machineId: "W02",
    name: "Weaving Machine 02",
    status: "RUNNING",
    orderId: "ORD103",
    productionRate: 98,
    producedMeters: 820,
    targetMeters: 1500,
    temperature: 58,
    efficiency: 0.87,
    costPerHour: 580,
    runtimeHours: 5.2,
    estimatedCompletion: "2026-10-18T10:00:00",
  },
  {
    machineId: "W03",
    name: "Weaving Machine 03",
    status: "RUNNING",
    orderId: "ORD106",      // new order, W03 referenced in profit leakage for ORD091
    productionRate: 105,
    producedMeters: 340,
    targetMeters: 800,
    temperature: 63,
    efficiency: 0.89,
    costPerHour: 600,
    runtimeHours: 2.1,
    estimatedCompletion: "2026-10-12T14:00:00",
  },
  {
    machineId: "W04",
    name: "Weaving Machine 04",
    status: "RUNNING",
    orderId: "ORD107",
    productionRate: 88,
    producedMeters: 560,
    targetMeters: 1200,
    temperature: 57,
    efficiency: 0.83,
    costPerHour: 620,
    runtimeHours: 4.0,
    estimatedCompletion: "2026-10-16T12:00:00",
  },
  {
    // IDLE — waiting for next order after completing ORD102
    machineId: "W05",
    name: "Weaving Machine 05",
    status: "IDLE",
    orderId: null,
    productionRate: 0,
    producedMeters: 0,
    targetMeters: 0,
    temperature: 32,
    efficiency: 0,
    costPerHour: 580,
    runtimeHours: 0,
    estimatedCompletion: null,
  },
  {
    // DOWN — machine fault, requires maintenance
    machineId: "W06",
    name: "Weaving Machine 06",
    status: "DOWN",
    orderId: null,
    productionRate: 0,
    producedMeters: 0,
    targetMeters: 0,
    temperature: 45,        // elevated temp indicates fault
    efficiency: 0,
    costPerHour: 600,
    runtimeHours: 0,
    estimatedCompletion: null,
  },
];
