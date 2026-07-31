# ApexCare EHR

Electronic Health Record system for ApexCare PMR practice.

## Docker Deployment (Recommended)

**Prerequisites:** Docker and Docker Compose

### Production Mode

1. Start the application:
   ```bash
   docker compose up -d --build
   ```

2. Access the application at http://localhost:3000

3. View logs:
   ```bash
   docker compose logs -f
   ```

4. Stop the application:
   ```bash
   docker compose down
   ```

5. Rebuild after code changes:
   ```bash
   docker compose down && docker compose up -d --build
   ```

The database (PostgreSQL) is automatically provisioned and seeded on first startup.

### Development Mode (Hot Reload)

For local development with live code mounting:

1. Start in development mode:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
   Or use npm script:
   ```bash
   npm run docker:dev
   ```

2. Access the application at http://localhost:3000

3. Code changes are automatically reflected (hot reload enabled)

4. Stop the development server:
   ```bash
   docker compose -f docker-compose.dev.yml down
   ```
   Or:
   ```bash
   npm run docker:dev:down
   ```

The development setup mounts your local code into the container, so changes are immediately reflected without rebuilding.

**Default login:** mariuska.aristica@apexcare.health / apex123

## Local Development (without Docker)

**Prerequisites:** Node.js 20+, PostgreSQL 16+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/apexcare_ehr
   AUTH_SECRET=your-secret-key
   ```

3. Initialize database:
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

## Architecture

- **Framework:** Next.js 15 with TypeScript
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Deployment:** Docker (standalone output)
