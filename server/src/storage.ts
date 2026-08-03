import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";

// Deliberately no ".svg" (nor html/xhtml/xml): an SVG is an active document, and
// attachments are served from the same origin as the SPA, so serving one as
// image/svg+xml would let an uploader run script against a viewer's session.
// Anything not listed here degrades to application/octet-stream.
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

export function contentTypeFor(name: string): string {
  return (
    CONTENT_TYPES[extname(name).toLowerCase()] ?? "application/octet-stream"
  );
}

async function ensureDir(): Promise<void> {
  if (!existsSync(env.storageDir)) {
    await mkdir(env.storageDir, { recursive: true });
  }
}

// Guard against path traversal: only allow a bare file name inside the store.
function resolveSafe(name: string): string {
  const safe = basename(name);
  return join(env.storageDir, safe);
}

export interface StoredFile {
  path: string; // file name within the store
  src: string; // browser URL served by GET /storage/attachments/:name
  type: string;
}

// `ext` is chosen by the caller from its MIME allowlist, never taken from the
// client's filename — otherwise an uploader controls the extension, and the
// extension is what contentTypeFor() uses to pick the response Content-Type.
export async function saveFile(
  buffer: Buffer,
  ext: string,
): Promise<StoredFile> {
  await ensureDir();
  const name = `${randomUUID()}${ext}`;
  await writeFile(resolveSafe(name), buffer);
  return {
    path: name,
    src: `/storage/attachments/${name}`,
    type: contentTypeFor(name),
  };
}

export async function readStoredFile(name: string): Promise<Buffer | null> {
  const target = resolveSafe(name);
  if (!existsSync(target)) return null;
  return readFile(target);
}

export async function deleteFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      if (!path) return;
      try {
        await unlink(resolveSafe(path));
      } catch {
        // Missing file: nothing to clean up.
      }
    }),
  );
}
