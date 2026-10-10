// Wage calculation helper for Workers module
// Formula: wage = hoursWorked * hourlyRate + overtimeHours * hourlyRate * 1.5

export function calculateWage(hoursWorked = 0, overtimeHours = 0, hourlyRate = 0) {
  const regularWage = Number(hoursWorked) * Number(hourlyRate);
  const overtimeWage = Number(overtimeHours) * Number(hourlyRate) * 1.5;
  return regularWage + overtimeWage;
}

export function calculateRegularPay(hoursWorked = 0, hourlyRate = 0) {
  return Number(hoursWorked) * Number(hourlyRate);
}

export function calculateOvertimePay(overtimeHours = 0, hourlyRate = 0) {
  return Number(overtimeHours) * Number(hourlyRate) * 1.5;
}

// Aggregates totals across all worker logs
export function calculateWorkerTotals(workerList = []) {
  let totalRegular = 0;
  let totalOvertime = 0;

  workerList.forEach((w) => {
    totalRegular += calculateRegularPay(w.hoursWorked, w.hourlyRate);
    totalOvertime += calculateOvertimePay(w.overtimeHours, w.hourlyRate);
  });

  return {
    totalRegular,
    totalOvertime,
    totalWorkforce: totalRegular + totalOvertime,
  };
}

// Groups workers by orderId and aggregates metrics
export function calculateLabourCostPerOrder(workerList = []) {
  const orderMap = {};

  workerList.forEach((w) => {
    const orderId = w.orderId || "UNKNOWN";
    if (!orderMap[orderId]) {
      orderMap[orderId] = {
        orderId,
        workerIds: new Set(),
        totalHours: 0,
        totalCost: 0,
      };
    }

    orderMap[orderId].workerIds.add(w.workerId);
    orderMap[orderId].totalHours += Number(w.hoursWorked || 0) + Number(w.overtimeHours || 0);
    orderMap[orderId].totalCost += calculateWage(w.hoursWorked, w.overtimeHours, w.hourlyRate);
  });

  return Object.values(orderMap).map((item) => ({
    orderId: item.orderId,
    distinctWorkersCount: item.workerIds.size,
    totalHours: Number(item.totalHours.toFixed(1)),
    totalCost: item.totalCost,
  }));
}
