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
import { sendEmployeeCredentials } from "../utils/sendEmployeeCredentials";

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

const generatePassword = (
  name: string,
  lastName: string,
  numeral: number,
): string => {
  // primeras 3 letras apellido
  const lastNamePart =
    lastName.trim().substring(0, 1).toUpperCase() +
    lastName.trim().substring(1, 3).toLowerCase();

  // primeras 3 letras nombre
  const namePart = name.trim().substring(0, 3).toLowerCase();

  // primera letra del apellido en mayúscula
  const firstCharLastName = lastName.trim().charAt(0).toUpperCase();

  // ASCII del apellido
  const asciiValue = firstCharLastName.charCodeAt(0);

  return `${lastNamePart}${numeral}${namePart}${asciiValue}`;
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, roleId, locationId, numeral, celular } =
      req.body;

    // VALIDACIÓN
    if (!name || !lastName || !roleId || !email || !numeral || !celular) {
      return res.status(400).json({
        message: "Debes completar nombre, apellido, correo y rol",
      });
    }

    // GENERAR PASSWORD
    const generatedPassword = generatePassword(name, lastName, numeral);
    console.log(generatedPassword)
    // HASHEAR
    const saltRounds = 10;

    const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);

    // CREAR EMPLEADO
    const data = await createEmployeeRepo({
      name,
      lastName,
      email,
      password: hashedPassword,
      roleId,
      locationId,
      numeral,
      celular,
    });

    // ENVIAR CORREO
    await sendEmployeeCredentials({
      email,
      name,
      lastName,
      password: generatedPassword,
    });

    return res.json(data);
  } catch (error: any) {
    console.error(error);

    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Este correo ya está registrado",
      });
    }

    return res.status(500).json({
      message: "No se pudo crear el empleado",
    });
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

    const { name, lastName, email, roleId, locationId, password, numeral, celular } = req.body;

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
      numeral,
      celular,
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

    return res
      .status(500)
      .json({ message: "No se puedo actualizar la información del empleado" });
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
    return res
      .status(500)
      .json({ message: "Ocurrió un error al validar el empleado" });
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
    return res
      .status(500)
      .json({ message: "Ocurrió un error al cambiar la contraseña" });
  }
};
