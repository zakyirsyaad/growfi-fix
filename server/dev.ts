import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number(process.env.PORT || 3000);

if (!process.env.NEXT_PUBLIC_REALTIME_URL) {
  process.env.NEXT_PUBLIC_REALTIME_URL = `http://${hostname}:${port}`;
}
process.env.REALTIME_PORT = String(port);
process.env.REALTIME_CORS_ORIGIN =
  process.env.REALTIME_CORS_ORIGIN || `http://${hostname}:${port}`;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const { attachRealtimeServer } = await import("./socket");
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  attachRealtimeServer(server);

  server.listen(port, () => {
    console.log(`GrowFi app and realtime listening on http://${hostname}:${port}`);
  });
});
