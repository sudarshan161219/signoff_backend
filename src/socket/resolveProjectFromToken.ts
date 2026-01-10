import { prisma } from "../utils/prismaClient";
import { ActorRole } from "@prisma/client";

export const resolveProjectFromToken = async (token: string) => {
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ adminToken: token }, { publicToken: token }],
    },
    select: {
      id: true,
      adminToken: true,
      publicToken: true,
    },
  });

  if (!project) return null;

  const role =
    token === project.adminToken
      ? ActorRole.ADMIN
      : ActorRole.CLIENT;

  return { projectId: project.id, role };
};
