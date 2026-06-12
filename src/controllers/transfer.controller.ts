import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  approveTransferRepo,
  createTransferRepo,
  getTransfersByLocationRepo,
  rejectTransferRepo,
} from "../repository/transfer.repository";
import { notificationRepository } from "../repository/notification.repository";

export const createTransfer = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const { origenId, destinationId, items, glosa } = req.body;

    if (!items?.length) {
      return res.status(400).json({ message: "Items requeridos" });
    }
    console.log("createTransferRepo", {
      requestedById: user.id,
      toLocationId: destinationId ? destinationId : user.locationId,
      fromLocationId: origenId ? origenId : 1,
    });
    const data = await createTransferRepo({
      requestedById: user.id,
      toLocationId: destinationId ? destinationId : user.locationId,
      fromLocationId: origenId ? origenId : 1,
      items,
      glosa,
    });
    console.log(data)
    let dataAprobado;
    /*if (destinationId) {
      dataAprobado = await approveTransferRepo(data.id, user.id, 1);

      try {
        await notificationRepository.createForAll({
          type: "TRANSFER",
          title: "Transferencia aprobada",
          body: `Transferencia ${dataAprobado?.transferCode} aprobada automáticamente`,
          transferId: data.id,
        });
      } catch (notifError) {
        console.error(
          "❌ Error al crear notificación de transferencia:",
          notifError,
        );
      }
    } else {*/
      try {
        await notificationRepository.createForAll({
          type: "TRANSFER",
          title: "Nueva transferencia solicitada",
          body: `Transferencia ${data?.transferCode} solicitada`,
          transferId: data.id,
        });
      } catch (notifError) {
        console.error(
          "❌ Error al crear notificación de transferencia:",
          notifError,
        );
      }
    //}

    return res.json(dataAprobado ? dataAprobado : data);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "error creating request" });
  }
};

export const getMyTransfers = async (_req: Request, res: Response) => {
  const data = await getTransfersByLocationRepo();
  res.json(data);
};

export const approveTransfer = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const { id } = req.params;
    const { fromLocationId } = req.body;

    if (!fromLocationId) {
      return res.status(400).json({ message: "Falta origen" });
    }

    const data = await approveTransferRepo(Number(id), user.id, fromLocationId);

    try {
      await notificationRepository.createForAll({
        type: "TRANSFER",
        title: "Transferencia aprobada",
        body: `Transferencia ${data?.transferCode} fue aprobada`,
        transferId: Number(id),
      });
    } catch (notifError) {
      console.error(
        "❌ Error al crear notificación de transferencia:",
        notifError,
      );
    }

    return res.json(data);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const rejectTransfer = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const { id } = req.params;

    const data = await rejectTransferRepo(Number(id), user.id);

    try {
      await notificationRepository.createForAll({
        type: "TRANSFER",
        title: "Transferencia rechazada",
        body: `Transferencia ${data?.transferCode} fue rechazada`,
        transferId: Number(id),
      });
    } catch (notifError) {
      console.error(
        "❌ Error al crear notificación de transferencia:",
        notifError,
      );
    }

    res.json(data);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
