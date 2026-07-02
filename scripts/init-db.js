const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();
const prismaDir = path.join(projectRoot, "prisma");
const dbPath = path.join(prismaDir, "dev.db");

console.log("🔄 Starting container database initialization...");

// 1. Ensure prisma directory exists
if (!fs.existsSync(prismaDir)) {
  console.log(`📁 Creating prisma directory at ${prismaDir}...`);
  fs.mkdirSync(prismaDir, { recursive: true });
}

// 2. Generate Prisma Client
console.log("⚙️ Generating Prisma Client for current container architecture...");
try {
  execSync("npx --no-install prisma generate", { stdio: "inherit", cwd: projectRoot });
} catch (error) {
  console.log("⚠️ npx --no-install failed, trying standard generate...");
  try {
    execSync("npx prisma generate", { stdio: "inherit", cwd: projectRoot });
  } catch (err) {
    console.error("❌ Prisma Client generation failed:", err.message);
    process.exit(1);
  }
}

// 3. Synchronize Schema (db push)
console.log("🗄️ Synchronizing DB schema (Prisma db push)...");
try {
  // Ensure DATABASE_URL is pointing correctly
  const env = { ...process.env, DATABASE_URL: "file:./dev.db" };
  execSync("npx --no-install prisma db push --skip-generate", { stdio: "inherit", cwd: projectRoot, env });
} catch (error) {
  console.log("⚠️ npx --no-install failed, trying standard db push...");
  try {
    const env = { ...process.env, DATABASE_URL: "file:./dev.db" };
    execSync("npx prisma db push --skip-generate", { stdio: "inherit", cwd: projectRoot, env });
  } catch (err) {
    console.error("❌ DB push failed:", err.message);
    process.exit(1);
  }
}

// 4. Seed check
console.log("🌱 Checking if database needs to be seeded...");
try {
  // Run a small plain JS script to inspect the database user count using the prisma client we just generated
  const checkCode = `
const { PrismaClient } = require("@prisma/client");
const client = new PrismaClient();
async function check() {
  try {
    const userCount = await client.user.count();
    console.log("USER_COUNT:" + userCount);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}
check();
  `;
  
  const checkFile = path.join(prismaDir, "check-db.js");
  fs.writeFileSync(checkFile, checkCode);
  
  const output = execSync("node prisma/check-db.js", { cwd: projectRoot, encoding: "utf8" });
  fs.unlinkSync(checkFile); // clean up
  
  const match = output.match(/USER_COUNT:(\d+)/);
  const count = match ? parseInt(match[1], 10) : 0;
  
  if (count === 0) {
    console.log("📢 Database is empty. Running seed script...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: projectRoot });
    console.log("✅ Seed successfully completed!");
  } else {
    console.log(`✅ Database already populated with ${count} users. Skipping seeding.`);
  }
} catch (error) {
  console.log("⚠️ Database check/seed ran into an error, ensuring seed is run as fallback:", error.message);
  try {
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: projectRoot });
    console.log("✅ Seed completed after fallback!");
  } catch (seedErr) {
    console.error("❌ Seeding fallback failed as well:", seedErr.message);
  }
}

console.log("🎉 Database initialization completed successfully!");
