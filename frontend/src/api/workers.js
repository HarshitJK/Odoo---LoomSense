// Workers & Attendance API calls
// Endpoints: GET /api/workers, POST /api/attendance
// Based on: docs/api.md

import client from "./client.js";

/**
 * Fetch all workers with their latest assignment from the API.
 * Returns: [{ workerId, name, hourlyRate, shift, latestAssignment }]
 */
export async function fetchWorkers() {
  const res = await client.get("/api/workers");
  return res.data;
}

/**
 * Log attendance hours for a worker.
 * Body: { workerId, orderId, machineId, hoursWorked, overtimeHours, date }
 * Returns the saved attendance record.
 */
export async function postAttendance(attendanceRecord) {
  const res = await client.post("/api/attendance", attendanceRecord);
  return res.data;
}
