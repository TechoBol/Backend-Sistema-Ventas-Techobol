import { Request, Response } from "express";
import prisma from "../config/db";

import {
  getProductsRepo,
  getProductByIdRepo,
  updateProductRepo,
  deleteProductRepo,
  getKardexRepo,
  getKardexRepository,
} from "../repository/product.repository";
import jwt from "jsonwebtoken";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      code,
      price,
      finalPrice,
      stock,
      locationId,
      lineId,
      brandName,
    } = req.body;

    if (
      !name ||
      !code ||
      price == null ||
      finalPrice == null ||
      locationId == null ||
      !lineId ||
      !brandName
    ) {
      return res.status(400).json({
        message: "Por favor, completa los campos requeridos",
      });
    }

    const line = await prisma.line.findUnique({
      where: {
        id: Number(lineId),
      },
    });

    if (!line) {
      return res.status(400).json({
        message: "Línea inválida",
      });
    }

    const brands = (line.brands as string[]) || [];

    const isValidBrand = brands.some(
      (b) => b.toLowerCase().trim() === brandName.toLowerCase().trim(),
    );

    if (!isValidBrand) {
      return res.status(400).json({
        message: "La marca no pertenece a la línea",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: name.trim().toUpperCase(),
          description,
          code: code.trim(),
          price: Number(price),
          finalPrice: Number(finalPrice),
          lineId: Number(lineId),
          brandName: brandName.trim(),
        },
      });

      await tx.inventory.create({
        data: {
          productId: product.id,
          locationId: Number(locationId),

          quantity: Number(stock) || 0,

          averageCost: Number(price),
        },
      });

      console.log("📦 Inventario creado");

      if (Number(stock) > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,

            toLocationId: Number(locationId),

            quantity: Number(stock),

            type: "IN",

            unitCost: Number(price),

            reference: "STOCK INICIAL",
          },
        });

      }

      return product;
    });


    return res.status(201).json(result);
  } catch (err: any) {
    console.error(" ERROR CREATE PRODUCT:", err);

    if (err.code === "P2002") {
      return res.status(400).json({
        message: "El producto ya está registrado",
      });
    }

    return res.status(500).json({
      message: "No se pudo crear el producto",
    });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const isManagement = user.level === 1 || user.level === 4;

    const products = await getProductsRepo(
      Number(user.locationId),
      isManagement,
    );

    return res.json(products);
  } catch {
    return res
      .status(500)
      .json({ message: "No se pudieron obtener los productos" });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const product = await getProductByIdRepo(id);

    if (!product) {
      return res.status(404).json({ message: "No se encontró el producto" });
    }

    return res.json(product);
  } catch {
    return res.status(500).json({ message: "No se pudo cargar el producto" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      description,
      code,
      imageUrl,
      price,
      finalPrice,
      stock,
      locationId,
      lineId,
      brandName,
      inventoryEdited
    } = req.body;

    if (!name || !code || !lineId || !brandName) {
      return res.status(400).json({
        message: "Campos incompletos",
      });
    }

    const line = await prisma.line.findUnique({
      where: { id: Number(lineId) },
    });

    if (!line) {
      return res.status(400).json({
        message: "Línea inválida",
      });
    }

    const brands = (line.brands as string[]) || [];

    const isValidBrand = brands.some(
      (b) => b.toLowerCase().trim() === brandName.toLowerCase().trim(),
    );

    if (!isValidBrand) {
      return res.status(400).json({
        message: "Marca inválida",
      });
    }

    const updated = await updateProductRepo(id, {
      name,
      description,
      code,
      imageUrl,
      price: Number(price),
      finalPrice: Number(finalPrice),
      lineId: Number(lineId),
      brandName: brandName.trim(),
      stock: stock !== undefined && stock !== null ? Number(stock) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
      inventoryEdited
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error updateProduct:", error);

    return res.status(500).json({
      message: "No se pudo actualizar el producto",
    });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await deleteProductRepo(id);

    return res.json({ message: "Producto eliminado" });
  } catch {
    return res.status(500).json({ message: "No se pudo eliminar el producto" });
  }
};

export const getKardex = async (req: Request, res: Response) => {
  try {

    const kardex = await getKardexRepo(req.body);

    return res.status(200).json(kardex); 
  } catch (error) {
    console.error("Error en kardex:", error);

    return res.status(500).json({
      message: "Error al generar kardex",
    });
  }
};

export const getKardexPro = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await getKardexRepository(
      req.body,
    );

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message:
        error.message ||
        "Error obteniendo kardex",
    });
  }
};