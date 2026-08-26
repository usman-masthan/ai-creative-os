import { createAtthasMarketingManagerServer } from "../src/dashboard/marketingServer.js";

const port = Number(process.env.ATTHAS_WORKSPACE_PORT ?? 4174);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("ATTHAS_WORKSPACE_PORT must be a valid TCP port.");
}
const rootDir = process.env.ATTHAS_STORE_DIR?.trim() || ".atthas-os";
const server = createAtthasMarketingManagerServer({ rootDir });
server.listen(port, "127.0.0.1", () => {
  console.log(`ATTHA’S Marketing Manager: http://127.0.0.1:${port}/workspace`);
  console.log(`Persistence: ${rootDir}`);
  console.log(`Gemini: ${process.env.GEMINI_API_KEY?.trim() ? "configured" : "not configured"}`);
  console.log(`AI image spend: ${process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true" ? "allowed" : "off"}`);
});
