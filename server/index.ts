import { createServer as createHttpServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";

export function createServer(): Server {
  return createHttpServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const port = Number(process.env.PORT ?? 5188);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`server listening on http://127.0.0.1:${port}`);
  });
}
