import prisma from "../config/db";

//////////////////////////////////////////////////////////
// GET PRODUCTS
//////////////////////////////////////////////////////////

export const getProductsRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  if (isManagement) {
    const products = await prisma.product.findMany({
      where: {
        isVisible: true,
      },

      include: {
        line: true,

        baseUnit: true,

        productUnits: {
          include: {
            unit: true,
          },
        },

        inventories: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return products.map((p) => ({
      ...p,

      stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
    }));
  }

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
    },

    include: {
      line: true,

      baseUnit: true,

      productUnits: {
        include: {
          unit: true,
        },
      },

      inventories: {
        where: {
          locationId,
        },

        include: {
          location: true,
        },
      },
    },
  });

  return products.map((p) => ({
    ...p,

    stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
  }));
};

//////////////////////////////////////////////////////////
// GET PRODUCT BY ID
//////////////////////////////////////////////////////////

export const getProductByIdRepo = async (id: number) => {
  return prisma.product.findUnique({
    where: {
      id,
    },

    include: {
      line: true,

      baseUnit: true,

      productUnits: {
        include: {
          unit: true,
        },
      },

      inventories: {
        include: {
          location: true,
        },
      },
    },
  });
};

//////////////////////////////////////////////////////////
// UPDATE PRODUCT
//////////////////////////////////////////////////////////

export const updateProductRepo = async (id: number, data: any) => {
  const {
    productUnits = [],
    applyStockUpdate = false,
    stock = 0,
    averageCost = 0,
    locationId,
    ...productData
  } = data;

  const locId = Number(locationId);

  if (!locId) {
    throw new Error("locationId es requerido");
  }

  return prisma.$transaction(async (tx) => {
    //////////////////////////////////////////////////////
    // VALIDAR DEFAULT
    //////////////////////////////////////////////////////
    const defaultUnits = productUnits.filter((x: any) => x.isDefault);

    if (defaultUnits.length !== 1) {
      throw new Error("Debe existir una presentación por defecto");
    }

    const defaultPresentation = defaultUnits[0];

    //////////////////////////////////////////////////////
    // UNIDAD BASE
    //////////////////////////////////////////////////////
    const baseUnit = await tx.unit.findUnique({
      where: { code: productData.baseUnitCode },
    });

    if (!baseUnit) {
      throw new Error("Unidad base inválida");
    }

    //////////////////////////////////////////////////////
    // INVENTARIO (CORRECTO: UNIQUE)
    //////////////////////////////////////////////////////
    const inventory = await tx.inventory.findUnique({
      where: {
        productId_locationId: {
          productId: id,
          locationId: locId,
        },
      },
    });

    if (!inventory) {
      throw new Error("Inventario no encontrado");
    }

    //////////////////////////////////////////////////////
    // STOCK + COSTO PROMEDIO (CORRECTO)
    //////////////////////////////////////////////////////
    const oldStock = Number(inventory.quantity);
    const oldCost = Number(inventory.averageCost);

    const newStock = Number(stock);
    const newCost = Number(averageCost);

    let finalStock = oldStock;
    let finalAverageCost = oldCost;

    if (applyStockUpdate && newStock > 0) {
      const totalStock = oldStock + newStock;

      finalStock = totalStock;

      finalAverageCost =
        totalStock > 0
          ? (oldStock * oldCost + newStock * newCost) / totalStock
          : 0;
    }

    //////////////////////////////////////////////////////
    // UNIDADES
    //////////////////////////////////////////////////////
    const unitCodes = productUnits.map((u: any) =>
      u.unitCode.trim().toUpperCase(),
    );

    const units = await tx.unit.findMany({
      where: {
        code: { in: unitCodes },
      },
    });

    if (units.length !== unitCodes.length) {
      throw new Error("Existen unidades inválidas");
    }

    const unitMap = new Map(
      units.map((u) => [u.code.toUpperCase(), u]),
    );

    //////////////////////////////////////////////////////
    // ACTUALIZAR PRODUCTO
    //////////////////////////////////////////////////////
    await tx.product.update({
      where: { id },
      data: {
        name: productData.name?.trim()?.toUpperCase(),
        description: productData.description,
        code: productData.code?.trim(),
        lineId: Number(productData.lineId),
        brandName: productData.brandName,
        baseUnitId: baseUnit.id,
        purchasePrice: finalAverageCost,
        salePrice: Number(defaultPresentation.salePrice),
      },
    });

    //////////////////////////////////////////////////////
    // UPSERT PRODUCT UNITS (SIN DELETE)
    //////////////////////////////////////////////////////
    const existingUnits = await tx.productUnit.findMany({
      where: { productId: id },
    });

    const existingMap = new Map(
      existingUnits.map((u) => [u.unitId, u]),
    );

    for (const item of productUnits) {
      const unit = unitMap.get(
        item.unitCode.trim().toUpperCase(),
      );

      if (!unit) {
        throw new Error(`Unidad no encontrada: ${item.unitCode}`);
      }

      const existing = existingMap.get(unit.id);

      if (existing) {
        await tx.productUnit.update({
          where: { id: existing.id },
          data: {
            equivalence: Number(item.equivalence),
            salePrice: Number(item.salePrice),
            purchasePrice: finalAverageCost,
            isDefault: item.isDefault || false,
          },
        });
      } else {
        await tx.productUnit.create({
          data: {
            productId: id,
            unitId: unit.id,
            equivalence: Number(item.equivalence),
            salePrice: Number(item.salePrice),
            purchasePrice: finalAverageCost,
            isDefault: item.isDefault || false,
          },
        });
      }
    }

    //////////////////////////////////////////////////////
    // INVENTARIO UPDATE
    //////////////////////////////////////////////////////
    await tx.inventory.update({
      where: {
        productId_locationId: {
          productId: id,
          locationId: locId,
        },
      },
      data: {
        quantity: finalStock,
        averageCost: finalAverageCost,
      },
    });

    //////////////////////////////////////////////////////
    // MOVIMIENTO (IMPORTACIÓN)
    //////////////////////////////////////////////////////
    const defaultUnit = await tx.productUnit.findFirst({
      where: {
        productId: id,
        isDefault: true,
      },
    });

    if (applyStockUpdate && newStock > 0 && defaultUnit) {
      await tx.stockMovement.create({
        data: {
          productId: id,
          productUnitId: defaultUnit.id,
          toLocationId: locId,
          quantity: newStock,
          presentationQuantity: newStock,
          type: "IN",
          unitCost: newCost,
          reference: "IMPORTACIÓN",
        },
      });
    }

    //////////////////////////////////////////////////////
    // RETURN FINAL
    //////////////////////////////////////////////////////
    return tx.product.findUnique({
      where: { id },
      include: {
        line: true,
        baseUnit: true,
        productUnits: {
          include: { unit: true },
        },
        inventories: {
          include: { location: true },
        },
      },
    });
  }, {
    timeout: 15000,
  });
};
//////////////////////////////////////////////////////////
// DELETE PRODUCT
//////////////////////////////////////////////////////////

export const deleteProductRepo = async (id: number) => {
  return prisma.product.update({
    where: {
      id,
    },

    data: {
      isVisible: false,
    },
  });
};
