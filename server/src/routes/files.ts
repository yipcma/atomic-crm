import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../auth/middleware.js";
import { contentTypeFor, readStoredFile, saveFile } from "../storage.js";

export const storageRoutes = new Hono();

// Upload an attachment; returns the stored path and browser-facing URL.
storageRoutes.post("/upload", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "Missing file field" });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await saveFile(buffer, file.name, file.type);
  return c.json(stored, 201);
});

// Public read access: attachment URLs are embedded in <img>/<a> tags and the
// file names are unguessable UUIDs.
storageRoutes.get("/attachments/:name", async (c) => {
  const name = c.req.param("name");
  const buffer = await readStoredFile(name);
  if (!buffer) {
    throw new HTTPException(404, { message: "File not found" });
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
