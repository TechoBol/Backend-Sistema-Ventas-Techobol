import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/db";

import {
  getProductsRepo,
  getProductByIdRepo,
  updateProductRepo,
  deleteProductRepo,
  getKardexRepository,
  getKardexRepo,
  updateMargenProductRepo,
  getStockByBranchesRepo,
  getValuedInventoryRepo,
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
      porcentajeGanancia,
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
          porcentajeGanancia: Number(porcentajeGanancia || 0),
        },
      });

      ////////////////////////////////////////////////
      // PRESENTACIONES
      ////////////////////////////////////////////////

      const createdPresentations = [];

      const baseCost = Number(averageCost || 0);

      for (const item of productUnits) {
        const unit = unitMap.get(item.unitCode);

        const equivalence = Number(item.equivalence || 1);

        // 🔥 costo proporcional por unidad
        const unitPurchasePrice = baseCost * equivalence;

        const created = await tx.productUnit.create({
          data: {
            productId: product.id,
            unitId: unit.id,
            equivalence,

            // ✔️ AQUÍ está la corrección real
            purchasePrice: unitPurchasePrice,

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

    const isManagement = true;

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

export const getKardexRepo = async ({
  productId,
  fromDate,
  toDate,
  locationId,
  linea,
  marca,
}: {
  productId?: number | null;
  fromDate?: string;
  toDate?: string;
  locationId?: number | null;
  linea?: number;
  marca?: string;
}) => {
  console.log("📥 INPUT:", { productId, fromDate, toDate, locationId });

  ////////////////////////////////////////////////////////////
  // 🔥 FECHAS
  ////////////////////////////////////////////////////////////

  const parseDate = (dateStr?: string, end = false) => {
    if (!dateStr) return null;
    const d = new Date(end ? `${dateStr}T23:59:59` : `${dateStr}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const from = parseDate(fromDate);
  const to = parseDate(toDate, true);

  ////////////////////////////////////////////////////////////
  // 🔥 PRODUCTOS
  ////////////////////////////////////////////////////////////

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,

      ...(productId && { id: productId }),

      ...(linea && { lineId: linea }),

      ...(marca &&
        marca.trim() !== "" && {
          brandName: { contains: marca, mode: "insensitive" },
        }),
    },
    include: { line: true },
  });

  ////////////////////////////////////////////////////////////
  // 🔥 MOVIMIENTOS DEL RANGO
  ////////////////////////////////////////////////////////////

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(productId && { productId }),

      ...(locationId && {
        OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
      }),

      ...(from &&
        to && {
          createdAt: { gte: from, lte: to },
        }),
    },
    include: {
      product: { include: { line: true } },
      transfer: true,
      fromLocation: true,
      toLocation: true,
    },
    orderBy: { createdAt: "asc" },
  });

  ////////////////////////////////////////////////////////////
  // 🔥 MOVIMIENTOS ANTERIORES AL RANGO (para saldo inicial)
  ////////////////////////////////////////////////////////////

  const movimientosAnteriores = from
    ? await prisma.stockMovement.findMany({
        where: {
          ...(productId && { productId }),

          ...(locationId && {
            OR: [
              { fromLocationId: locationId },
              { toLocationId: locationId },
            ],
          }),

          createdAt: { lt: from },
        },
        include: {
          transfer: true,
          fromLocation: true,
          toLocation: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const resultado: any[] = [];

  ////////////////////////////////////////////////////////////
  // 🔥 RECORRER PRODUCTOS
  ////////////////////////////////////////////////////////////

  for (const product of products) {
    //////////////////////////////////////////////////////////
    // 🔥 INVENTARIO ACTUAL
    //////////////////////////////////////////////////////////

    const inventory = await prisma.inventory.findMany({
      where: {
        productId: product.id,
        ...(locationId && { locationId }),
      },
    });

    const stockActual = inventory.reduce((acc, inv) => acc + inv.quantity, 0);

    const inventoryCost =
      inventory.length > 0
        ? inventory.reduce((acc, inv) => acc + inv.averageCost, 0) /
          inventory.length
        : product.purchasePrice;

    //////////////////////////////////////////////////////////
    // 🔥 CALCULAR SALDO INICIAL (movimientos ANTES del rango)
    //////////////////////////////////////////////////////////

    let saldoCantidad = 0;
    let saldoTotal = 0;
    let costoPromedio = 0;

    if (from) {
      const movsPrevios = movimientosAnteriores.filter(
        (m) => m.productId === product.id
      );

      for (const mov of movsPrevios) {
        let entrada = 0;
        let salida = 0;
        let costo = Number(mov.unitCost || 0);

        if (mov.type === "IN") {
          entrada = mov.quantity;
        } else if (mov.type === "OUT") {
          salida = mov.quantity;
        } else if (mov.type === "TRANSFER") {
          if (locationId) {
            if (mov.toLocationId === locationId) entrada = mov.quantity;
            if (mov.fromLocationId === locationId) salida = mov.quantity;
          }
          // Global: transferencias se anulan entre sí, no afectan stock total
        }

        if (entrada > 0) {
          if (costo <= 0) costo = costoPromedio;
          saldoTotal += entrada * costo;
          saldoCantidad += entrada;
          costoPromedio =
            saldoCantidad > 0 ? saldoTotal / saldoCantidad : costo;
        }

        if (salida > 0) {
          const salidaTotal = salida * costoPromedio;
          saldoCantidad -= salida;
          saldoTotal -= salidaTotal;
        }
      }
    }

    //////////////////////////////////////////////////////////
    // 🔥 MOVIMIENTOS DEL PRODUCTO EN EL RANGO
    //////////////////////////////////////////////////////////

    const movimientosProducto: any[] = [];

    for (const mov of movements.filter((m) => m.productId === product.id)) {
      let entrada = 0;
      let salida = 0;
      let detalle = "";
      let codigoMovimiento = "";

      ////////////////////////////////////////////////////////
      // 🔥 INGRESOS
      ////////////////////////////////////////////////////////

      if (mov.type === "IN") {
        entrada = mov.quantity;
        detalle = (mov.reference || "COMPRA / IMPORTACIÓN").toUpperCase();
      }

      ////////////////////////////////////////////////////////
      // 🔥 SALIDAS
      ////////////////////////////////////////////////////////

      if (mov.type === "OUT") {
        salida = mov.quantity;
        detalle = (mov.reference || "SALIDA").toUpperCase();
      }

      ////////////////////////////////////////////////////////
      // 🔥 TRANSFERENCIAS
      ////////////////////////////////////////////////////////

      if (mov.type === "TRANSFER") {
        const transferCode = mov.transfer?.transferCode || `TR-${mov.id}`;
        const fromName = mov.fromLocation?.name?.toUpperCase() || "ORIGEN";
        const toName = mov.toLocation?.name?.toUpperCase() || "DESTINO";

        codigoMovimiento = transferCode;

        if (locationId) {
          if (mov.toLocationId === locationId) {
            entrada = mov.quantity;
            detalle = `TRANSFERENCIA ENTRADA ${transferCode} ${fromName} → ${toName}`;
          }

          if (mov.fromLocationId === locationId) {
            salida = mov.quantity;
            detalle = `TRANSFERENCIA SALIDA ${transferCode} ${fromName} → ${toName}`;
          }
        } else {
          movimientosProducto.push({
            fecha: mov.createdAt,
            codigoMovimiento: transferCode,
            detalle: `TRANSFERENCIA SALIDA ${transferCode} ${fromName} → ${toName}`.toUpperCase(),
            entrada: 0,
            salida: mov.quantity,
            costoUnitario: mov.unitCost || 0,
          });

          movimientosProducto.push({
            fecha: mov.createdAt,
            codigoMovimiento: transferCode,
            detalle: `TRANSFERENCIA ENTRADA ${transferCode} ${fromName} → ${toName}`.toUpperCase(),
            entrada: mov.quantity,
            salida: 0,
            costoUnitario: mov.unitCost || 0,
          });

          continue;
        }
      }

      movimientosProducto.push({
        fecha: mov.createdAt,
        codigoMovimiento,
        detalle: detalle.toUpperCase(),
        entrada,
        salida,
        costoUnitario: mov.unitCost || 0,
      });
    }

    //////////////////////////////////////////////////////////
    // 🔥 ORDENAR
    //////////////////////////////////////////////////////////

    movimientosProducto.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    //////////////////////////////////////////////////////////
    // 🔥 SIN MOVIMIENTOS
    //////////////////////////////////////////////////////////

    if (movimientosProducto.length === 0) {
      resultado.push({
        producto: product.name,
        barcode: product.code,
        linea: product.line?.name || "-",
        marca: product.brandName || "-",
        kardex: [
          {
            fecha: from ?? new Date(),
            codigoMovimiento: "",
            detalle: from ? "SALDO INICIAL" : "SIN MOVIMIENTOS",
            entrada: 0,
            salida: 0,
            saldoCantidad,
            costoUnitario: costoPromedio || inventoryCost,
            entradaTotal: 0,
            salidaTotal: 0,
            saldoTotal: saldoCantidad > 0 ? saldoTotal : stockActual * inventoryCost,
          },
        ],
      });

      continue;
    }

    //////////////////////////////////////////////////////////
    // 🔥 KARDEX
    //////////////////////////////////////////////////////////

    const kardexProducto: any[] = [];

    ////////////////////////////////////////////////////////
    // 🔥 FILA DE SALDO INICIAL (solo si hay filtro de fecha)
    ////////////////////////////////////////////////////////

    if (from) {
      kardexProducto.push({
        fecha: from,
        codigoMovimiento: "",
        detalle: "SALDO INICIAL",
        entrada: 0,
        salida: 0,
        saldoCantidad,
        costoUnitario: costoPromedio,
        entradaTotal: 0,
        salidaTotal: 0,
        saldoTotal,
      });
    }

    ////////////////////////////////////////////////////////
    // 🔥 MOVIMIENTOS DEL PERÍODO
    ////////////////////////////////////////////////////////

    for (const mov of movimientosProducto) {
      let costoMovimiento = Number(mov.costoUnitario || 0);

      if (mov.entrada > 0 && costoMovimiento <= 0) {
        costoMovimiento = costoPromedio;
      }

      const entradaTotal = mov.entrada * costoMovimiento;

      if (mov.entrada > 0) {
        saldoTotal += entradaTotal;
        saldoCantidad += mov.entrada;
        costoPromedio =
          saldoCantidad > 0 ? saldoTotal / saldoCantidad : costoMovimiento;
      }

      let salidaTotal = 0;

      if (mov.salida > 0) {
        salidaTotal = mov.salida * costoPromedio;
        saldoCantidad -= mov.salida;
        saldoTotal -= salidaTotal;
      }

      kardexProducto.push({
        fecha: mov.fecha,
        codigoMovimiento: mov.codigoMovimiento || "",
        detalle: mov.detalle,
        entrada: mov.entrada,
        salida: mov.salida,
        saldoCantidad,
        costoUnitario: mov.entrada > 0 ? costoMovimiento : costoPromedio,
        entradaTotal,
        salidaTotal,
        saldoTotal,
      });
    }

    resultado.push({
      producto: product.name,
      barcode: product.code,
      linea: product.line?.name || "-",
      marca: product.brandName || "-",
      kardex: kardexProducto,
    });
  }

  console.log("✅ Kardex generado:", resultado.length, "productos");

  return resultado;
};

export const getKardexPro = async (req: Request, res: Response) => {
  try {
    const data = await getKardexRepository(req.body);

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error obteniendo kardex",
    });
  }
};

export const updateMargenProduct = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const {
      porcentajeGanancia,

      quantityDiscount,

      bossDiscount,
    } = req.body;

    //////////////////////////////////////////////////////
    // VALIDACIONES
    //////////////////////////////////////////////////////

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    if (porcentajeGanancia === undefined || porcentajeGanancia === null) {
      return res.status(400).json({
        message: "porcentajeGanancia es requerido",
      });
    }

    //////////////////////////////////////////////////////
    // UPDATE
    //////////////////////////////////////////////////////

    const product = await updateMargenProductRepo(
      Number(id),

      Number(porcentajeGanancia),

      Number(quantityDiscount),

      Number(bossDiscount),
    );

    return res.status(200).json({
      message: "Margen actualizado correctamente",

      product,
    });
  } catch (error: any) {
    console.error("UPDATE MARGEN ERROR:", error);

    return res.status(500).json({
      message: error.message || "No se pudo actualizar el margen",
    });
  }
};

//////////////////////////////////////////////////////////
// GET STOCK BY BRANCHES
//////////////////////////////////////////////////////////

export const getStockByBranches = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    // Solo levels que NO pueden cambiar sucursal pueden usar esto
    // Ajusta los levels según tu lógica
    const canChangeBranch = user.level === 1 || user.level === 2;

    const productId = Number(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({ message: "productId inválido" });
    }

    const branches = await getStockByBranchesRepo(productId);

    return res.json({
      // Le avisamos al front si puede o no cambiar sucursal
      // para que sepa si mostrar el expand o no
      canChangeBranch,
      branches: branches.map((inv) => ({
        locationId: inv.location.id,
        locationName: inv.location.name,
        abbreviation: inv.location.abbreviation,
        stock: inv.quantity,
      })),
    });
  } catch {
    return res.status(500).json({
      message: "No se pudo obtener el stock por sucursales",
    });
  }
};

export const getValuedInventory = async (req: Request, res: Response) => {
  try {
    const { locationId, productId, lineId, brand, hasta } = req.body;

    const inventory = await getValuedInventoryRepo(
      locationId && Number(locationId) > 0 ? Number(locationId) : undefined,

      productId && Number(productId) > 0 ? Number(productId) : undefined,

      lineId && Number(lineId) > 0 ? Number(lineId) : undefined,

      brand && brand !== "TODAS" ? brand : undefined,

      hasta ? new Date(new Date(hasta).setHours(23, 59, 59, 999)) : undefined,
    );

    return res.json(inventory);
  } catch (error) {
    console.error("ERROR INVENTARIO VALORADO:", error);

    return res.status(500).json({
      message: "No se pudo generar el inventario valorado",
    });
  }
};
