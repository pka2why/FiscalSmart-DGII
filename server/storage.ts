import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_ROOT = process.env.DATA_DIR || "/data";

export function ensureDataRoot(): void {
  const root = getDataRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
}

export function getDataRoot(): string {
  // Local/dev fallback when /data is not writable
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.NODE_ENV !== "production") {
    return path.join(process.cwd(), "data");
  }
  return DATA_ROOT;
}

export function saveUpload(opts: {
  tenantId: string;
  batchId: string;
  originalName: string;
  buffer: Buffer;
}): { storagePath: string; absolutePath: string } {
  const safeName = opts.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relative = path
    .join("uploads", opts.tenantId, opts.batchId, `${randomUUID()}_${safeName}`)
    .replace(/\\/g, "/");
  const absolutePath = path.join(getDataRoot(), relative);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, opts.buffer);
  return { storagePath: relative, absolutePath };
}

export function resolveStoragePath(storagePath: string): string {
  const absolute = path.join(getDataRoot(), storagePath);
  const root = path.resolve(getDataRoot());
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}
