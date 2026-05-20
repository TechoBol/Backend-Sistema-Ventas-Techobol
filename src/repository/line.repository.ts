import prisma from "../config/db";

export const getLinesRepo = async () => {
  return prisma.line.findMany({
    where: { isVisible: true },
    orderBy: { name: "asc" },
  });
};

export const createLinesRepo = async (data: any) => {
  const exists = await prisma.line.findFirst({
    where: {
      name: data.name,
    },
  });

  if (exists) {
    throw new Error("Ya existe una línea con ese nombre");
  }

  return prisma.line.create({
    data: {
      name: data.name,
      description: data.description,
      brands: data.brands ?? [],
    },
  });
};

export const deleteLinesRepo = async (id: number) => {
  return prisma.line.update({
    where: { id },
    data: { isVisible: false },
  });
};

export const updateLineRepo = async (
  id: number,
  name: string,
  brands: string[]
) => {
  const line = await prisma.line.findUnique({ where: { id } });

  if (!line) throw new Error("Línea no encontrada");

  // validar duplicados en brands
  const uniqueBrands = [...new Set(brands)];
  if (uniqueBrands.length !== brands.length) {
    throw new Error("No se permiten marcas duplicadas");
  }

  return prisma.line.update({
    where: { id },
    data: {
      name,
      brands,
    },
  });
};
