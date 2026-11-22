import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { fileURLToPath } from "node:url";
import { createProxy, type ProxyOptions } from "./proxy";

export function createServer(opts: ProxyOptions = {}): Server {
  const proxy = createProxy(opts);
  return createHttpServer((req, res) => {
    void proxy(req, res).then((handled) => {
      if (!handled) route(req, res);
    });
  });
}

function route(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const port = Number(process.env.PORT ?? 5188);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`server listening on http://127.0.0.1:${port}`);
  });
}
