
import { Request, Response } from "express";
import {
  getRolesRepo,
  createRoleRepo,
  updateRoleRepo,
  deleteRoleRepo,
} from "../repository/role.repository";

export const getRoles = async (_: Request, res: Response) => {
  const data = await getRolesRepo();
  return res.json(data);
};

export const createRole = async (req: Request, res: Response) => {
  const { name, description, maxEmployeesAllowed } = req.body;

  if (!name) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  const data = await createRoleRepo({
    name,
    description,
    maxEmployeesAllowed,
  });

  return res.json(data);
};

export const updateRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await updateRoleRepo(id, req.body);
  return res.json(data);
};

export const deleteRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteRoleRepo(id);
  return res.json({ message: "Role eliminado" });
};