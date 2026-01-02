// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// export default prisma;

// import "dotenv/config";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { PrismaClient } from "../../generated/prisma/client";

// const connectionString = `${process.env.DATABASE_URL}`;

// const adapter = new PrismaPg({ connectionString });
// const prisma = new PrismaClient({ adapter });

// export { prisma };

import { PrismaClient } from "@prisma/client";

// 1. Define a global type to prevent TypeScript errors on 'globalThis'
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 2. Initialize Prisma
// We pass NO arguments to use the default config (which loads DATABASE_URL from .env)
export const prisma = globalForPrisma.prisma || new PrismaClient();

// 3. Save the instance in development to prevent "Too many connections" errors during hot reloads
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
