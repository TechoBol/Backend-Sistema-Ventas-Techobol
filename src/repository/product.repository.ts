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

      stockTotal: p.inventories.reduce(
        (acc, inv) => acc + inv.quantity,
        0,
      ),
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

    stockTotal: p.inventories.reduce(
      (acc, inv) => acc + inv.quantity,
      0,
    ),
  }));
};

//////////////////////////////////////////////////////////
// GET PRODUCT BY ID
//////////////////////////////////////////////////////////

export const getProductByIdRepo = async (
  id: number,
) => {
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

export const updateProductRepo = async (
  id: number,
  data: any,
) => {
  const {
    productUnits,
    ...productData
  } = data;

  return prisma.$transaction(async (tx) => {
    //////////////////////////////////////////////////////
    // VALIDAR DEFAULT
    //////////////////////////////////////////////////////

    const defaultCount = productUnits.filter(
      (x: any) => x.isDefault,
    ).length;

    if (defaultCount !== 1) {
      throw new Error(
        "Debe existir una presentación por defecto",
      );
    }

    //////////////////////////////////////////////////////
    // ACTUALIZAR PRODUCTO
    //////////////////////////////////////////////////////

    const defaultPresentation =
      productUnits.find(
        (x: any) => x.isDefault,
      );

    await tx.product.update({
      where: {
        id,
      },

      data: {
        name: productData.name
          ?.trim()
          ?.toUpperCase(),

        description:
          productData.description,

        code: productData.code
          ?.trim(),

        lineId: Number(
          productData.lineId,
        ),

        brandName:
          productData.brandName,

        baseUnitId: Number(
          productData.baseUnitId,
        ),

        purchasePrice: Number(
          productData.purchasePrice || 0,
        ),

        salePrice: Number(
          defaultPresentation.salePrice,
        ),
      },
    });

    //////////////////////////////////////////////////////
    // ELIMINAR PRESENTACIONES
    //////////////////////////////////////////////////////

    await tx.productUnit.deleteMany({
      where: {
        productId: id,
      },
    });

    //////////////////////////////////////////////////////
    // CREAR PRESENTACIONES
    //////////////////////////////////////////////////////

    for (const item of productUnits) {
      await tx.productUnit.create({
        data: {
          productId: id,

          unitId: Number(item.unitId),

          equivalence: Number(
            item.equivalence,
          ),

          purchasePrice: Number(
            item.purchasePrice || 0,
          ),

          salePrice: Number(
            item.salePrice,
          ),

          isDefault:
            item.isDefault || false,
        },
      });
    }

    //////////////////////////////////////////////////////
    // RETORNAR
    //////////////////////////////////////////////////////

    return tx.product.findUnique({
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
  });
};

//////////////////////////////////////////////////////////
// DELETE PRODUCT
//////////////////////////////////////////////////////////

export const deleteProductRepo = async (
  id: number,
) => {
  return prisma.product.update({
    where: {
      id,
    },

    data: {
      isVisible: false,
    },
  });
};