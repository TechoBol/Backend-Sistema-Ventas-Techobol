import prisma from "../config/db";

export async function seedGenericCustomer() {
  const existing = await prisma.customer.findFirst({
    where: { isGeneric: true },
  });

  if (!existing) {
    await prisma.customer.create({
      data: {
        name: "Consumidor Final",
        code: "GENERICO",
        isGeneric: true,
      },
    });
    console.log("✅ Cliente genérico creado");
  }
}