
import prisma from "../config/db";

export const getRolesRepo = async () => {
  return prisma.role.findMany({
    where: { isVisible: true },
    orderBy: { name: "asc" },
  });
};

export const createRoleRepo = async (data: any) => {
  return prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      level: data.level || 0,
    },
  });
};

export const updateRoleRepo = async (id: number, data: any) => {
  return prisma.role.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      level: data.level,
    },
  });
};

export const deleteRoleRepo = async (id: number) => {
  return prisma.role.update({
    where: { id },
    data: { isVisible: false },
  });
};