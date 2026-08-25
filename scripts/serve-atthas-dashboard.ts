import { createAtthasDashboardServer } from "../src/dashboard/server.js";

const port = Number(process.env.ATTHAS_DASHBOARD_PORT ?? 4173);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("ATTHAS_DASHBOARD_PORT must be a valid TCP port.");
}
const rootDir = process.env.ATTHAS_STORE_DIR?.trim() || ".atthas-os";
const server = createAtthasDashboardServer({ rootDir });
server.listen(port, "127.0.0.1", () => {
  console.log(`ATTHA’S Creative OS dashboard: http://127.0.0.1:${port}`);
  console.log(`Persistence: ${rootDir}`);
});
