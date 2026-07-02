import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceDbPath = path.join(projectRoot, "prisma", "dev.db");
const functionRoot = path.join(
  projectRoot,
  ".netlify",
  "functions-internal",
  "___netlify-server-handler",
);
const bundledDbDir = path.join(functionRoot, "prisma");
const bundledDbPath = path.join(bundledDbDir, "dev.db");
const envPath = path.join(functionRoot, ".env");

if (!fs.existsSync(sourceDbPath)) {
  throw new Error(`Source database not found at ${sourceDbPath}`);
}

if (!fs.existsSync(functionRoot)) {
  console.log(
    "Netlify function bundle not found yet. Skipping DB copy in this phase.",
  );
  process.exit(0);
}

fs.mkdirSync(bundledDbDir, { recursive: true });
fs.copyFileSync(sourceDbPath, bundledDbPath);

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  const nextEnv = env.includes('DATABASE_URL="file:./prisma/dev.db"')
    ? env
    : env.replace('DATABASE_URL="file:./dev.db"', 'DATABASE_URL="file:./prisma/dev.db"');
  fs.writeFileSync(envPath, nextEnv);
}

console.log(`Bundled SQLite database at ${bundledDbPath}`);