import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/db";

import {
  getProductsRepo,
  getProductByIdRepo,
  updateProductRepo,
  deleteProductRepo,
} from "../repository/product.repository";

//////////////////////////////////////////////////////////
// CREATE PRODUCT
//////////////////////////////////////////////////////////

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      code,

      lineId,
      brandName,

      baseUnitCode,

      stock,
      averageCost,

      locationId,

      productUnits,
    } = req.body;

    //////////////////////////////////////////////////////
    // VALIDACIONES
    //////////////////////////////////////////////////////

    if (
      !name ||
      !code ||
      !lineId ||
      !brandName ||
      !baseUnitCode ||
      !locationId
    ) {
      return res.status(400).json({
        message: "Campos requeridos incompletos",
      });
    }

    if (!Array.isArray(productUnits) || productUnits.length === 0) {
      return res.status(400).json({
        message: "Debes registrar al menos una presentación",
      });
    }

    //////////////////////////////////////////////////////
    // VALIDAR LINEA
    //////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////
    // UNIDAD BASE
    //////////////////////////////////////////////////////

    const baseUnit = await prisma.unit.findUnique({
      where: {
        code: baseUnitCode,
      },
    });

    if (!baseUnit) {
      return res.status(400).json({
        message: "Unidad base inválida",
      });
    }

    //////////////////////////////////////////////////////
    // VALIDAR UNIDADES
    //////////////////////////////////////////////////////

    const unitCodes = productUnits.map((x: any) => x.unitCode);

    const units = await prisma.unit.findMany({
      where: {
        code: {
          in: unitCodes,
        },
      },
    });

    if (units.length !== unitCodes.length) {
      return res.status(400).json({
        message: "Existen unidades inválidas",
      });
    }

    //////////////////////////////////////////////////////
    // MAPA
    //////////////////////////////////////////////////////

    const unitMap = new Map();

    units.forEach((u) => {
      unitMap.set(u.code, u);
    });

    //////////////////////////////////////////////////////
    // DEFAULT
    //////////////////////////////////////////////////////

    const defaultCount = productUnits.filter((x: any) => x.isDefault).length;

    if (defaultCount !== 1) {
      return res.status(400).json({
        message: "Debe existir una presentación por defecto",
      });
    }

    //////////////////////////////////////////////////////
    // TRANSACCIÓN
    //////////////////////////////////////////////////////

    const result = await prisma.$transaction(async (tx) => {
      ////////////////////////////////////////////////
      // PRESENTACIÓN DEFAULT
      ////////////////////////////////////////////////

      const defaultPresentation = productUnits.find((x: any) => x.isDefault);

      ////////////////////////////////////////////////
      // PRODUCTO
      ////////////////////////////////////////////////

      const product = await tx.product.create({
        data: {
          name: name.trim().toUpperCase(),
      
          description,
      
          code: code.trim(),
      
          lineId: Number(lineId),
      
          brandName: brandName.trim(),
      
          baseUnitId: baseUnit.id,
      
          purchasePrice: Number(averageCost || 0),
      
          salePrice: Number(defaultPresentation.salePrice),
        },
      });

      ////////////////////////////////////////////////
      // PRESENTACIONES
      ////////////////////////////////////////////////

      const createdPresentations = [];

      for (const item of productUnits) {
        const unit = unitMap.get(item.unitCode);

        const created = await tx.productUnit.create({
          data: {
            productId: product.id,

            unitId: unit.id,

            equivalence: Number(item.equivalence),

            purchasePrice: Number(averageCost || 0),

            salePrice: Number(item.salePrice),


            isDefault: item.isDefault || false,
          },
        });

        createdPresentations.push(created);
      }

      ////////////////////////////////////////////////
      // INVENTARIO
      ////////////////////////////////////////////////

      await tx.inventory.create({
        data: {
          productId: product.id,

          locationId: Number(locationId),

          quantity: Number(stock || 0),

          averageCost: Number(averageCost || 0),
        },
      });

      ////////////////////////////////////////////////
      // MOVIMIENTO
      ////////////////////////////////////////////////

      if (Number(stock) > 0) {
        const defaultUnit = createdPresentations.find((x) => x.isDefault);

        await tx.stockMovement.create({
          data: {
            productId: product.id,

            productUnitId: defaultUnit?.id,

            toLocationId: Number(locationId),

            quantity: Number(stock),

            presentationQuantity: Number(stock),

            type: "IN",

            unitCost: Number(averageCost || 0),

            reference: "STOCK INICIAL",
          },
        });
      }

      return await tx.product.findUnique({
        where: {
          id: product.id,
        },

        include: {
          baseUnit: true,

          line: true,

          productUnits: {
            include: {
              unit: true,
            },
          },

          inventories: {
            include: {
              location: true,
            },
          },
        },
      });
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("ERROR CREATE PRODUCT:", err);

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

//////////////////////////////////////////////////////////
// GET PRODUCTS
//////////////////////////////////////////////////////////

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
    return res.status(500).json({
      message: "No se pudieron obtener los productos",
    });
  }
};

//////////////////////////////////////////////////////////
// GET PRODUCT BY ID
//////////////////////////////////////////////////////////

export const getProductById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const product = await getProductByIdRepo(id);

    if (!product) {
      return res.status(404).json({
        message: "No se encontró el producto",
      });
    }

    return res.json(product);
  } catch {
    return res.status(500).json({
      message: "No se pudo cargar el producto",
    });
  }
};

//////////////////////////////////////////////////////////
// UPDATE PRODUCT
//////////////////////////////////////////////////////////

  export const updateProduct = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      const updated = await updateProductRepo(id, req.body);

      return res.json(updated);
    } catch (error: any) {
      console.error("UPDATE PRODUCT ERROR:", error);
    
      return res.status(500).json({
        message: error.message || "No se pudo actualizar el producto",
        error,
      });
    }
  };

//////////////////////////////////////////////////////////
// DELETE PRODUCT
//////////////////////////////////////////////////////////

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await deleteProductRepo(id);

    return res.json({
      message: "Producto eliminado",
    });
  } catch {
    return res.status(500).json({
      message: "No se pudo eliminar el producto",
    });
  }
};
