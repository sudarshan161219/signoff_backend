// import { PrismaClient } from "@prisma/client";

// export const prisma = new PrismaClient();

import { PrismaClient } from "@prisma/client";

// FIX: Pass an empty object {} to satisfy the constructor check
const prismaClientSingleton = () => {
  return new PrismaClient({});
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
