import prisma from '../config/db'

export const getAllLocationsRepository = async () => {
  return prisma.location.findMany({
    where: { isVisible: true },
    orderBy: { id: "desc" },
  });
};

export const createLocationRepository = async (data: any) => {
  return prisma.location.create({
    data,
  });
};

export const updateLocationRepository = async (id: number, data: any) => {
  return prisma.location.update({
    where: { id },
    data,
  });
};

export const deleteLocationRepository = async (id: number) => {
  return prisma.location.update({
    where: { id },
    data: { isVisible: false },
  });
};