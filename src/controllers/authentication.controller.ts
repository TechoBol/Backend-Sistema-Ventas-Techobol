import { Response, Request } from "express";
import { config } from "dotenv";
import prisma from "../config/db";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";

import { getOneEmployeeToValidateToken } from "../repository/employee.repository";
config();

export const signIn = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }
    const employee = await prisma.employee.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        password: true,
        role: {
          select: {
            name: true,
            level: true
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            type: true,
            abbreviation: true,
            saleCounter: true,
          },
        },
      },
    });
    if (!employee) {
      return res.status(400).json({ message: "user not found" });
    }
    const passwordValid = await bcrypt.compare(
      password,
      employee.password as string,
    );
    if (!passwordValid) {
      return res.status(400).json({ message: "incorrect password" });
    }
    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        role: employee.role?.name,
        level: employee.role?.level,
        locationId: employee.location ? employee.location.id : null,
      },
      process.env.JWTSECRET as string,
    );
    
    return res.json({
      id: employee.id,
      name: employee.name,
      lastName: employee.lastName,
      email: employee.email,
      role: employee.role?.name,
      level: employee.role?.level,
      location: employee.location,
      token,
    });
  } catch (err) {
    return res.status(500).json({
      message: "internal error",
    });
  }
};

export const validateToken = async (req: Request, res: Response) => {
  try {
    const response = jwt.verify(
      req.body.token,
      process.env.JWTSECRET as string,
    );

    const password = (response as JwtPayload).password;
    const id = (response as JwtPayload).id;

    const employeeFound = await getOneEmployeeToValidateToken(id, password);

    if (!employeeFound) {
      return res.status(400).json({ message: "token is invalid" });
    }

    return res.status(200).json({ message: "token is valid" });
  } catch {
    return res.status(500).json({ message: "internal server error" });
  }
};
