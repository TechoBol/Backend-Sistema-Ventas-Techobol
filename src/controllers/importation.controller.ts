import { Request, Response } from "express";
import { ImportacionStatus } from "@prisma/client";
import {
  getImportationsRepo,
  getImportationByIdRepo,
  createImportationRepo,
  updateImportationRepo,
  verifyImportationRepo,
} from "../repository/importation.repository";
import { notificationRepository } from "../repository/notification.repository";

const normalizeStatus = (status?: string): ImportacionStatus => {
  if (!status) return ImportacionStatus.DRAFT;

  const normalized = status.toString().trim().toLowerCase();

  if (normalized === "verified" || normalized === "verificado") {
    return ImportacionStatus.VERIFIED;
  }

  return ImportacionStatus.DRAFT;
};

const getProductCountFromSnapshot = (snapshot: any): number => {
  if (!snapshot?.products || !Array.isArray(snapshot.products)) {
    return 0;
  }

  return snapshot.products.length;
};

export const getImportations = async (_req: Request, res: Response) => {
  try {
    const data = await getImportationsRepo();
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al cargar las importaciones.",
    });
  }
};

export const getImportationById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Id inválido.",
      });
    }

    const data = await getImportationByIdRepo(id);

    if (!data) {
      return res.status(404).json({
        message: "Importación no encontrada.",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al cargar la importación.",
    });
  }
};

export const createImportation = async (req: Request, res: Response) => {
  try {
    const {
      supplierName,
      referenceNumber,
      importationDate,
      officialExchangeRate,
      bankExchangeRate,
      ivaPercent,
      productCount,
      status,
      snapshot,
      locationId,
    } = req.body;

    const data = await createImportationRepo({
      supplierName,
      referenceNumber,
      importationDate,
      officialExchangeRate,
      bankExchangeRate,
      ivaPercent,
      productCount: productCount ?? getProductCountFromSnapshot(snapshot),
      status: normalizeStatus(status),
      snapshot,
      locationId: locationId ? Number(locationId) : null,
    });

    try {
      await notificationRepository.createForAll({
        type: "IMPORTACION",
        title: "Nueva importación registrada",
        body: `Importación ${data.referenceNumber ?? data.id} registrada`,
        importacionId: data.id,
        locationId: data.locationId ?? undefined,
      });
    } catch (notifError) {
      console.error("❌ Error al crear notificación de importación:", notifError);
    }

    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "No se pudo crear la importación.",
    });
  }
};

export const updateImportation = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Id inválido.",
      });
    }

    const {
      supplierName,
      referenceNumber,
      importationDate,
      officialExchangeRate,
      bankExchangeRate,
      ivaPercent,
      productCount,
      status,
      snapshot,
      locationId,
    } = req.body;

    const data = await updateImportationRepo(id, {
      supplierName,
      referenceNumber,
      importationDate,
      officialExchangeRate,
      bankExchangeRate,
      ivaPercent,
      productCount: productCount ?? getProductCountFromSnapshot(snapshot),
      status: normalizeStatus(status),
      snapshot,
      locationId: locationId ? Number(locationId) : undefined,
    });

    return res.json(data);
  } catch (error: any) {
    console.error(error);

    if (error.message === "VERIFIED_IMPORTATION_CANNOT_BE_EDITED") {
      return res.status(400).json({
        message: "Una importación verificada no puede editarse.",
      });
    }

    if (error.message === "IMPORTATION_NOT_FOUND") {
      return res.status(404).json({
        message: "Importación no encontrada.",
      });
    }

    return res.status(500).json({
      message: "No se pudo actualizar la importación.",
    });
  }
};

export const verifyImportation = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Id inválido.",
      });
    }

    const data = await verifyImportationRepo(id);

    try {
      await notificationRepository.createForAll({
        type: "IMPORTACION",
        title: "Importación verificada",
        body: `Importación ${data?.referenceNumber ?? data?.id} fue verificada`,
        importacionId: data?.id,
        locationId: data?.locationId ?? undefined,
      });
    } catch (notifError) {
      console.error("❌ Error al crear notificación de importación:", notifError);
    }

    return res.json({
      message: "Importación verificada correctamente.",
      data,
    });
  } catch (error: any) {
    console.error(error);

    if (error.message === "IMPORTATION_NOT_FOUND") {
      return res.status(404).json({
        message: "Importación no encontrada.",
      });
    }

    return res.status(500).json({
      message: "No se pudo verificar la importación.",
    });
  }
};