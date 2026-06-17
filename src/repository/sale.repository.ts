import prisma from "../config/db";

// Include reutilizable para todas las queries que necesitan generar PDF
const SALE_PDF_INCLUDE = {
  customer: true,
  location: true, // trae address, name, abbreviation, etc.
  employee: {
    select: {
      name: true,
      lastName: true,
    },
  },
  customerAddress: true,
  customerNit: true, // el registro CustomerNit relacionado
  details: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      productUnit: {
        include: {
          unit: true,
        },
      },
    },
  },
} as const;

// Select liviano para el listado (sin los datos pesados del PDF)
const SALE_LIST_SELECT = {
  id: true,
  code: true,
  subtotal: true,
  total: true,
  discount: true,
  date: true,
  pdfUrl: true,
  typeSale: true,
  transactionNumber: true,
  bankName: true,
  generateInvoice: true,
  status: true,

  customerNitSnapshot: true,
  customerNitCompanySnapshot: true,
  customerAddressSnapshot: true,

  customer: true,

  location: {
    select: {
      id: true,
      name: true,
      address: true, // ← necesario para el PDF (cabecera empresa)
      abbreviation: true,
    },
  },

  employee: {
    select: {
      name: true,
      lastName: true,
    },
  },

  details: {
    include: {
      product: true,
      productUnit: {
        include: {
          unit: true,
        },
      },

      outputLocation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

//////////////////////////////////////////////////////////
// 🔥 SALE
//////////////////////////////////////////////////////////

export const createSaleRepo = async (tx: any, data: any) => {
  return await tx.sale.create({ data });
};

//////////////////////////////////////////////////////////
// 🔥 LOCATION
//////////////////////////////////////////////////////////

export const incrementLocationCounterRepo = async (
  tx: any,
  locationId: number,
) => {
  return await tx.location.update({
    where: { id: locationId },
    data: {
      saleCounter: { increment: 1 },
    },
  });
};

//////////////////////////////////////////////////////////
// 🔥 SALE DETAIL
//////////////////////////////////////////////////////////

export const createSaleDetailRepo = async (tx: any, data: any) => {
  return await tx.saleDetail.create({ data });
};

//////////////////////////////////////////////////////////
// 🔥 INVENTORY
//////////////////////////////////////////////////////////

export const getInventoryRepo = async (
  tx: any,
  productId: number,
  locationId: number,
) => {
  return await tx.inventory.findUnique({
    where: {
      productId_locationId: { productId, locationId },
    },
  });
};

export const updateInventoryRepo = async (
  tx: any,
  productId: number,
  locationId: number,
  qty: number,
) => {
  return await tx.inventory.update({
    where: {
      productId_locationId: { productId, locationId },
    },
    data: {
      quantity: { decrement: qty },
    },
  });
};

//////////////////////////////////////////////////////////
// 🔥 PRODUCT
//////////////////////////////////////////////////////////

export const getProductRepo = async (tx: any, productId: number) => {
  return await tx.product.findUnique({ where: { id: productId } });
};

//////////////////////////////////////////////////////////
// 🔥 PRODUCT UNIT
//////////////////////////////////////////////////////////

export const getProductUnitRepo = async (tx: any, productUnitId: number) => {
  return await tx.productUnit.findUnique({
    where: { id: productUnitId },
    include: { unit: true },
  });
};

//////////////////////////////////////////////////////////
// 🔥 STOCK MOVEMENT
//////////////////////////////////////////////////////////

export const createStockMovementRepo = async (tx: any, data: any) => {
  return await tx.stockMovement.create({ data });
};

//////////////////////////////////////////////////////////
// 🔥 GET SALE BY ID (para PDF o detalle)
//////////////////////////////////////////////////////////

export const getSaleByIdRepo = async (id: number) => {
  return prisma.sale.findUnique({
    where: { id },
    include: SALE_PDF_INCLUDE,
  });
};

//////////////////////////////////////////////////////////
// 🔥 GET SALE BY ID IN TRANSACTION (al final de createSale)
//////////////////////////////////////////////////////////

export const getSaleByIdTxRepo = async (tx: any, id: number) => {
  return await tx.sale.findUnique({
    where: { id },
    include: SALE_PDF_INCLUDE,
  });
};

//////////////////////////////////////////////////////////
// 🔥 GET SALES (listado)
//////////////////////////////////////////////////////////

export const getSalesRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  return prisma.sale.findMany({
    where: isManagement
      ? {}
      : {
          OR: [
            {
              locationId,
            },
            {
              details: {
                some: {
                  outputLocationId: locationId,
                },
              },
            },
          ],
        },

    select: SALE_LIST_SELECT,
    orderBy: {
      date: "desc",
    },
  });
};
