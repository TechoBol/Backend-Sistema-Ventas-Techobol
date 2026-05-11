import prisma from "../config/db";
import { Employee } from "@prisma/client";

export const getEmployeesRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  return prisma.employee.findMany({
    where: {
      isVisible: true,
      ...(isManagement
        ? {}
        : {
            locationId: locationId, // 🔥 solo su sucursal
          }),
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      lastName: "asc",
    },
  });
};

export const createEmployeeRepo = async (data: Partial<Employee>) => {
  return prisma.employee.create({
    data: {
      name: data.name!,
      lastName: data.lastName!,
      email: data.email || null,
      password: data.password || null,
      roleId: data.roleId!,
      locationId: data.locationId || null, 
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const updateEmployeeRepo = async (
  id: number,
  data: Partial<Employee>,
) => {
  return prisma.employee.update({
    where: { id },
    data: {
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      roleId: data.roleId,
      locationId: data.locationId ?? null,
      ...(data.password && { password: data.password }), 
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const deleteEmployeeRepo = async (id: number) => {
  return prisma.employee.update({
    where: { id },
    data: {
      isVisible: false,
      email: Math.random().toString(36).slice(-10), // evitar conflicto unique
    },
  });
};

export const getOneEmployeeToValidateToken = async (
  id: number,
  password: string,
) => {
  return prisma.employee.findFirst({
    where: {
      id,
      password,
    },
    select: {
      id: true,
      name: true,
    },
  });
};

export const changePasswordRepository = async (
  id: number,
  newPassword: string,
) => {
  return prisma.employee.update({
    where: { id },
    data: {
      password: newPassword,
    },
  });
};
