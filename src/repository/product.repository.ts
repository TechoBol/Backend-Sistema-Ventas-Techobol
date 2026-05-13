import prisma from "../config/db";

type CreateProductDTO = {
  name: string;
  description?: string;
  code: string;
  imageUrl?: string;
  price: number;
  finalPrice: number;
  lineId: number;
  brandName: string;
};

export const createProductRepo = async (data: CreateProductDTO) => {
  return prisma.product.create({
    data,
  });
};

export const getProductsRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  if (isManagement) {
    const products = await prisma.product.findMany({
      where: { isVisible: true },
      include: {
        line: true,
        inventories: {
          include: {
            location: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return products
      .map((p) => ({
        ...p,
        stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
        inventories: p.inventories.map((inv) => ({
          locationId: inv.locationId,
          locationName: inv.location.name,
          quantity: inv.quantity,
        })),
      }))
      .sort((a, b) => b.stockTotal - a.stockTotal);
  }

  const products = await prisma.product.findMany({
    where: { isVisible: true },
    include: {
      line: true,
      inventories: {
        where: { locationId },
      },
    },
  });

  return products.sort((a, b) => {
    const stockA = a.inventories[0]?.quantity || 0;
    const stockB = b.inventories[0]?.quantity || 0;
    return stockB - stockA;
  });
};

export const getProductByIdRepo = async (id: number) => {
  return prisma.product.findUnique({
    where: { id },
    include: {
      line: true,
      inventories: true,
    },
  });
};

export const updateProductRepo = async (id: number, data: any) => {
  const { stock, locationId, inventoryEdited, ...productData } = data;

  return prisma.$transaction(async (tx) => {
    const currentProduct = await tx.product.findUnique({
      where: { id },
    });

    if (!currentProduct) {
      throw new Error("Producto no encontrado");
    }

    await tx.product.update({
      where: { id },
      data: {
        name: productData.name,
        description: productData.description,
        code: productData.code,
        price: productData.price,
        finalPrice: productData.finalPrice,
        lineId: productData.lineId,
        brandName: productData.brandName,
      },
    });
    if (inventoryEdited) {
      if (stock !== undefined && locationId) {
        const inventory = await tx.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: id,
              locationId,
            },
          },
        });

        if (!inventory) {
          await tx.inventory.create({
            data: {
              productId: id,
              locationId,

              quantity: stock,

              averageCost: productData.price,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: id,

              toLocationId: locationId,

              quantity: stock,

              type: "IN",

              unitCost: productData.price,

              reference: "NUEVO INGRESO",
            },
          });
        } else {
          const cantidadActual = inventory.quantity;

          const costoActual = inventory.averageCost;

          const totalActual = cantidadActual * costoActual;

          const totalNuevo = stock * productData.price;

          const nuevaCantidad = cantidadActual + stock;

          const nuevoPromedio =
            nuevaCantidad > 0
              ? (totalActual + totalNuevo) / nuevaCantidad
              : productData.price;

          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: id,
                locationId,
              },
            },

            data: {
              quantity: {
                increment: stock,
              },

              averageCost: nuevoPromedio,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: id,

              toLocationId: locationId,

              quantity: stock,

              type: "IN",

              unitCost: productData.price,

              reference: "REPOSICION STOCK",
            },
          });
        }
      }
    }

    return tx.product.findUnique({
      where: { id },
      include: {
        line: true,
        inventories: {
          include: {
            location: true,
          },
        },
      },
    });
  });
};

export const deleteProductRepo = async (id: number) => {
  return prisma.product.update({
    where: { id },
    data: { isVisible: false },
  });
};

