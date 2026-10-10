// Workers & Attendance API calls. Reads go through useApi (see hooks/useApi.js):
//   GET /api/workers                    -> [{ workerId, name, hourlyRate, shift, latestAssignment,
//                                             hoursThisMonth, overtimeThisMonth, wageThisMonth }]
//   GET /api/workers/wages/summary      -> { totalRegularWages, totalOvertimePay, totalWorkforceCost,
//                                            labourCostPerOrder: [{ orderId, workersInvolved, labourHours, labourCost }] }
// All wage numbers are calculated by the server; do not recompute them here.
// Based on: docs/api.md

import client from "./client.js";

/**
 * Log attendance hours for a worker.
 * Body: { workerId, orderId, machineId, hoursWorked, overtimeHours, date }
 * Returns the saved attendance record. Throws an axios error with response.data.detail on failure.
 */
export async function postAttendance(attendanceRecord) {
  const res = await client.post("/api/attendance", attendanceRecord);
  return res.data;
}
