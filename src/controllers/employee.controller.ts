import { Request, Response } from "express";
import {
  getEmployeesRepo,
  createEmployeeRepo,
  updateEmployeeRepo,
  deleteEmployeeRepo,
  getOneEmployeeToValidateToken,
  changePasswordRepository,
} from "../repository/employee.repository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//////////////////////////////
// GET ALL
//////////////////////////////
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const isManagement = user.level === 1 || user.level === 4;

    const data = await getEmployeesRepo(Number(user.locationId), isManagement);

    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al cargar los empleados." });
  }
};

//////////////////////////////
// CREATE
//////////////////////////////
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, password, roleId, locationId } = req.body;

    // VALIDACIÓN BÁSICA
    if (!name || !lastName || !roleId) {
      return res.status(400).json({
        message: "Debes completar nombre, apellido y rol",
      });
    }

    // CIFRAR PASSWORD
    let hashedPassword = null;

    if (password) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const data = await createEmployeeRepo({
      name,
      lastName,
      email,
      password: hashedPassword,
      roleId,
      locationId,
    });

    return res.json(data);
  } catch (error: any) {
    console.error(error);

    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Este correo ya está registrado",
      });
    }

    return res.status(500).json({ message: "No se pudo crear el empleado" });
  }
};

//////////////////////////////
// UPDATE
//////////////////////////////
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "id inválido" });
    }

    const { name, lastName, email, roleId, locationId, password } = req.body;

    let hashedPassword;
    if (password) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const data = await updateEmployeeRepo(id, {
      name,
      lastName,
      email,
      roleId,
      locationId,
      ...(hashedPassword && { password: hashedPassword }),
    });

    return res.json(data);
  } catch (error: any) {
    console.error(error);

    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Este correo ya está registrado",
      });
    }

    return res.status(500).json({ message: "No se puedo actualizar la información del empleado" });
  }
};

//////////////////////////////
// DELETE (SOFT DELETE)
//////////////////////////////
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "id inválido" });
    }

    const data = await deleteEmployeeRepo(id);

    return res.json({
      message: "Empleado eliminado correctamente",
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "No se pudo eliminar el empleado" });
  }
};

//////////////////////////////
// LOGIN VALIDATION (opcional)
//////////////////////////////
export const validateEmployee = async (req: Request, res: Response) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({
        message: "Ingresa tu correo y contraseña",
      });
    }

    const data = await getOneEmployeeToValidateToken(id, password);

    if (!data) {
      return res.status(401).json({
        message: "Usuario o contraseña incorrectos",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Ocurrió un error al validar el empleado" });
  }
};

//////////////////////////////
// CHANGE PASSWORD
//////////////////////////////
export const changePassword = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { newPassword } = req.body;

    if (!id || !newPassword) {
      return res.status(400).json({
        message: "Correo y nueva contraseña son obligatorios",
      });
    }

    const data = await changePasswordRepository(id, newPassword);

    return res.json({
      message: "Contraseña actualizada correctamente",
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Ocurrió un error al cambiar la contraseña" });
  }
};
