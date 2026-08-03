import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../auth/middleware.js";
import { contentTypeFor, readStoredFile, saveFile } from "../storage.js";

export const storageRoutes = new Hono();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// MIME type -> canonical extension. The stored extension comes from this map,
// never from the client's filename. Deliberately excludes svg/html/xml: those
// are active documents, and attachments share an origin with the SPA.
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg", // non-standard, but some browsers/clients still emit it
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/zip": ".zip",
};

// Upload an attachment; returns the stored path and browser-facing URL.
storageRoutes.post("/upload", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "Missing file field" });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HTTPException(413, {
      message: `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`,
    });
  }
  const declared = (file.type ?? "").split(";")[0].trim().toLowerCase();
  const ext = ALLOWED_UPLOAD_TYPES[declared];
  if (!ext) {
    throw new HTTPException(415, {
      message: `Unsupported file type: ${file.type || "unknown"}`,
    });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveFile(buffer, ext);
  return c.json(stored, 201);
});

// Public read access: attachment URLs are embedded in <img>/<a> tags and the
// file names are unguessable UUIDs. The headers below are what keep an
// attachment from becoming an XSS vector against the SPA it shares an origin
// with: `sandbox` denies scripting even for a document rendered inline.
storageRoutes.get("/attachments/:name", async (c) => {
  const name = c.req.param("name");
  const buffer = await readStoredFile(name);
  if (!buffer) {
    throw new HTTPException(404, { message: "File not found" });
  }
  const type = contentTypeFor(name);
  const inline = type.startsWith("image/") || type === "application/pdf";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; sandbox; frame-ancestors 'none'",
      "Content-Disposition": inline ? "inline" : "attachment",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
