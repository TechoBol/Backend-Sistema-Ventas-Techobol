import prisma from "../config/db";

// =====================================================
// 🔥 SALE
// =====================================================

export const createSaleRepo = async (
  tx: any,
  data: any,
) => {

  return await tx.sale.create({
    data,
  });

};

// =====================================================
// 🔥 LOCATION
// =====================================================

export const incrementLocationCounterRepo =
  async (
    tx: any,
    locationId: number,
  ) => {

    return await tx.location.update({

      where: {
        id: locationId,
      },

      data: {

        saleCounter: {
          increment: 1,
        },

      },

    });

  };

// =====================================================
// 🔥 SALE DETAIL
// =====================================================

export const createSaleDetailRepo =
  async (
    tx: any,
    data: any,
  ) => {

    return await tx.saleDetail.create({

      data,

    });

  };

// =====================================================
// 🔥 INVENTORY
// =====================================================

export const getInventoryRepo = async (
  tx: any,
  productId: number,
  locationId: number,
) => {

  return await tx.inventory.findUnique({

    where: {

      productId_locationId: {
        productId,
        locationId,
      },

    },

  });

};

export const updateInventoryRepo =
  async (
    tx: any,
    productId: number,
    locationId: number,
    qty: number,
  ) => {

    return await tx.inventory.update({

      where: {

        productId_locationId: {
          productId,
          locationId,
        },

      },

      data: {

        quantity: {
          decrement: qty,
        },

      },

    });

  };

// =====================================================
// 🔥 PRODUCT
// =====================================================

export const getProductRepo = async (
  tx: any,
  productId: number,
) => {

  return await tx.product.findUnique({

    where: {
      id: productId,
    },

  });

};

// =====================================================
// 🔥 SALES
// =====================================================

export const getSalesRepo = async (
  locationId: number,
  isManagement: boolean,
) => {

  return prisma.sale.findMany({

    where:
      isManagement
        ? {}
        : {
            locationId,
          },

    select: {

      id: true,

      code: true,

      subtotal: true,

      total: true,

      date: true,

      pdfUrl: true,

      typeSale: true,

      transactionNumber: true,

      customer: true,

      location: {

        select: {
          name: true,
        },

      },

      employee: {

        select: {

          name: true,

          lastName: true,

        },

      },

      details: {

        select: {

          id: true,

          quantity: true,

          unitPrice: true,

          itemDiscount: true,

          subtotal: true,

          product: {

            select: {

              id: true,

              name: true,

              code: true,

            },

          },

        },

      },

    },

    orderBy: {

      date: "desc",

    },

  });

};