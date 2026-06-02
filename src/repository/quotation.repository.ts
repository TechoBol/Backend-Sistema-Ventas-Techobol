import prisma from "../config/db";

//////////////////////////////////////////////////////////
// 🔥 QUOTATION
//////////////////////////////////////////////////////////

export const createQuotationRepo = async (tx: any, data: any) => {
  return await tx.quotation.create({ data });
};

export const createQuotationDetailRepo = async (tx: any, data: any) => {
  return await tx.quotationDetail.create({ data });
};

//////////////////////////////////////////////////////////
// 🔥 LOCATION
//////////////////////////////////////////////////////////

export const incrementQuotationCounterRepo = async (tx: any, locationId: number) => {
  return await tx.location.update({
    where: { id: locationId },
    data: { quotationCounter: { increment: 1 } },
  });
};

//////////////////////////////////////////////////////////
// 🔥 GET QUOTATIONS
//////////////////////////////////////////////////////////

export const getQuotationsRepo = async (locationId: number, isManagement: boolean) => {
  return prisma.quotation.findMany({
    where: isManagement ? {} : { locationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      subtotal: true,
      discount: true,
      total: true,
      status: true,
      notes: true,
      expiresAt: true,
      createdAt: true,
      customer: {
        include: {
          nits: true,
        },
      },
      location: {
        select: { name: true },
      },
      employee: {
        select: { name: true, lastName: true },
      },
      details: {
        include: {
          product: {
            select: { id: true, name: true, code: true },
          },
          productUnit: {
            include: { unit: true },
          },
        },
      },
    },
  });
};

export const getQuotationsByCustomerRepo = async (customerId: number) => {
  return prisma.quotation.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      pdfUrl: true,
      total: true,
      status: true,
      createdAt: true,
      
      customerNitSnapshot: true,

      location: {
        select: { name: true },
      },
      employee: {
        select: { name: true, lastName: true },
      },
    },
  });
};