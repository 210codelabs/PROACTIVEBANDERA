const { execSync } = require("node:child_process");

console.log("Starting ApexCare EHR...");

function waitForDb(maxRetries = 30, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const host = process.env.DB_HOST || "postgres";
      execSync(`node -e "require('net').createConnection(5432, '${host}').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"`, { stdio: "ignore" });
      console.log("PostgreSQL is ready.");
      return true;
    } catch {
      console.log(`Waiting for PostgreSQL... (${i + 1}/${maxRetries})`);
      execSync(`sleep ${delay / 1000}`);
    }
  }
  console.error("PostgreSQL did not become available in time.");
  process.exit(1);
}

waitForDb();

console.log("Generating Prisma Client...");
execSync("npx prisma generate", { stdio: "inherit" });

console.log("Synchronizing database schema...");
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

console.log("Checking if database needs seeding...");
try {
  const output = execSync("node -e \"const { PrismaClient } = require('@prisma/client'); const c = new PrismaClient(); c.user.count().then(n => { console.log('COUNT:' + n); c.$disconnect(); }).catch(e => { console.error(e); process.exit(1); })\"", { encoding: "utf8" });
  const match = output.match(/COUNT:(\d+)/);
  const count = match ? parseInt(match[1], 10) : 0;

  if (count === 0) {
    console.log("Database is empty. Running seed...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    console.log("Seed completed.");
  } else {
    console.log(`Database already has ${count} users. Skipping seed.`);
  }
} catch (err) {
  console.error("Seed check failed:", err.message);
}

console.log("Starting Next.js server...");
execSync("node server.js", { stdio: "inherit" });
