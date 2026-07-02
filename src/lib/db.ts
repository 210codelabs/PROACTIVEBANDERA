import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

function asExistingFileUrl(maybePath: string | null | undefined) {
  if (!maybePath) return null;
  if (fs.existsSync(maybePath)) return "file:" + maybePath;
  return null;
}

function ensureWritableNetlifyDb(sourcePath: string) {
  const tmpRoot = process.env.TMPDIR || "/tmp";
  const targetDir = path.join(tmpRoot, "proactiveclinics", "prisma");
  const targetPath = path.join(targetDir, "dev.db");

  try {
    fs.mkdirSync(targetDir, { recursive: true });

    const needsCopy =
      !fs.existsSync(targetPath) ||
      fs.statSync(sourcePath).mtimeMs > fs.statSync(targetPath).mtimeMs;

    if (needsCopy) {
      fs.copyFileSync(sourcePath, targetPath);
    }

    return "file:" + targetPath;
  } catch {
    // If /tmp is unavailable for any reason, fall back to the source path.
    return "file:" + sourcePath;
  }
}

function resolveDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL;

  if (configuredUrl?.startsWith("file:")) {
    const configuredPath = configuredUrl.replace(/^file:/, "");
    const absoluteConfiguredPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    let configuredFile = asExistingFileUrl(absoluteConfiguredPath);
    if (configuredFile) return configuredFile;

    // Check if the file is inside the prisma directory
    if (!path.isAbsolute(configuredPath)) {
      const prismaConfiguredPath = path.resolve(process.cwd(), "prisma", configuredPath);
      configuredFile = asExistingFileUrl(prismaConfiguredPath);
      if (configuredFile) return configuredFile;
    }
  }

  if (process.env.NETLIFY) {
    const lambdaTaskRoot = process.env.LAMBDA_TASK_ROOT;
    const candidates = [
      path.join(process.cwd(), "prisma", "dev.db"),
      path.join(process.cwd(), ".netlify", "functions-internal", "___netlify-server-handler", "prisma", "dev.db"),
      path.join("/var/task", "prisma", "dev.db"),
      path.join("/var/task", ".netlify", "functions-internal", "___netlify-server-handler", "prisma", "dev.db"),
      lambdaTaskRoot ? path.join(lambdaTaskRoot, "prisma", "dev.db") : "",
      lambdaTaskRoot ? path.join(lambdaTaskRoot, ".netlify", "functions-internal", "___netlify-server-handler", "prisma", "dev.db") : "",
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return ensureWritableNetlifyDb(candidate);
      }
    }

    // Fallback for Netlify bundles where the DB is copied relative to the function cwd.
    return "file:./prisma/dev.db";
  }

  return configuredUrl || "file:" + path.resolve(process.cwd(), "prisma/dev.db");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
