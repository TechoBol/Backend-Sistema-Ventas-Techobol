import { Request, Response } from "express";
import {
  getLinesRepo,
  createLinesRepo,
  deleteLinesRepo,
  updateLineRepo,
} from "../repository/line.repository";

export const getLines = async (_: Request, res: Response) => {
  const data = await getLinesRepo();
  return res.json(data);
};

export const createLines = async (req: Request, res: Response) => {
  try {
    const data = await createLinesRepo(req.body);
    return res.json(data);
  } catch (error: any) {
    return res.status(400).json({
      message: error.message,
    });
  }
};


export const deleteLines = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteLinesRepo(id);
  return res.json({ message: "Línea eliminada" });
};


export const updateLine = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, brands } = req.body;

  if (!name || !brands || !Array.isArray(brands)) {
    return res.status(400).json({
      message: "name y brands (array) son obligatorios",
    });
  }

  try {
    const data = await updateLineRepo(id, name, brands);
    return res.json(data);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
