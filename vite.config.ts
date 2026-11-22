import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

const MEDIA_DIR = resolve(import.meta.dirname, "media");
const MEDIA_TYPES: Record<string, string> = {
  ".spz": "application/octet-stream",
  ".ply": "application/octet-stream",
  ".json": "application/json",
};

/** Dev only: serves /media/* from the local media folder. Read only, no listing, no traversal. */
function serveMedia(): Plugin {
  return {
    name: "language-room-media",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/media", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        let relative: string;
        try {
          relative = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
        } catch {
          relative = "";
        }
        const file = resolve(MEDIA_DIR, `.${relative}`);
        const inside = file.startsWith(MEDIA_DIR + sep);
        let size = -1;
        try {
          const st = statSync(file);
          if (st.isFile()) size = st.size;
        } catch {
          // Missing file: answered below.
        }
        if (relative.includes("\0") || !inside || size < 0) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain");
          res.end("Not found");
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", MEDIA_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Content-Length", String(size));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [serveMedia()],
  server: {
    port: 5187,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:5188",
    },
  },
});
