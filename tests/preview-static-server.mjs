import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 9392);
const types = new Map([[".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".svg", "image/svg+xml"]]);

http.createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname).replace(/^\/+/, "");
    const filePath = path.resolve(root, requested || "tests/fixtures/file-sharing-preview.html");
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Chemin refusé");
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": types.get(path.extname(filePath)) || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Introuvable");
  }
}).listen(port, "127.0.0.1");
