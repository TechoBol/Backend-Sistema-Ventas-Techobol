import prisma from "../config/db";
import { ImportacionStatus, Prisma } from "@prisma/client";

type ImportationPayload = {
  supplierName?: string | null;
  referenceNumber?: string | null;
  importationDate?: string | Date | null;
  officialExchangeRate?: number | string | null;
  bankExchangeRate?: number | string | null;
  ivaPercent?: number | string | null;
  productCount?: number | null;
  status?: ImportacionStatus;
  snapshot?: Prisma.InputJsonValue | null;
};

export const getImportationsRepo = async () => {
  return prisma.importacion.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getImportationByIdRepo = async (id: number) => {
  return prisma.importacion.findUnique({
    where: { id },
  });
};

export const createImportationRepo = async (data: ImportationPayload) => {
  return prisma.importacion.create({
    data: {
      supplierName: data.supplierName ?? null,
      referenceNumber: data.referenceNumber ?? null,
      importationDate: data.importationDate
        ? new Date(data.importationDate)
        : null,

      officialExchangeRate: data.officialExchangeRate ?? 6.96,
      bankExchangeRate: data.bankExchangeRate ?? null,
      ivaPercent: data.ivaPercent ?? 14.94,

      productCount: data.productCount ?? 0,
      status: data.status ?? ImportacionStatus.DRAFT,

      snapshot: data.snapshot ?? Prisma.JsonNull,
    },
  });
};

export const updateImportationRepo = async (
  id: number,
  data: ImportationPayload,
) => {
  const current = await prisma.importacion.findUnique({
    where: { id },
  });

  if (!current) {
    throw new Error("IMPORTATION_NOT_FOUND");
  }

  if (current.status === ImportacionStatus.VERIFIED) {
    throw new Error("VERIFIED_IMPORTATION_CANNOT_BE_EDITED");
  }

  return prisma.importacion.update({
    where: { id },
    data: {
      supplierName: data.supplierName ?? null,
      referenceNumber: data.referenceNumber ?? null,
      importationDate: data.importationDate
        ? new Date(data.importationDate)
        : null,

      officialExchangeRate: data.officialExchangeRate ?? 6.96,
      bankExchangeRate: data.bankExchangeRate ?? null,
      ivaPercent: data.ivaPercent ?? 14.94,

      productCount: data.productCount ?? 0,
      status: data.status ?? ImportacionStatus.DRAFT,

      snapshot: data.snapshot ?? Prisma.JsonNull,
    },
  });
};

export const verifyImportationRepo = async (id: number) => {
  const current = await prisma.importacion.findUnique({
    where: { id },
  });

  if (!current) {
    throw new Error("IMPORTATION_NOT_FOUND");
  }

  return prisma.importacion.update({
    where: { id },
    data: {
      status: ImportacionStatus.VERIFIED,
    },
  });
};
