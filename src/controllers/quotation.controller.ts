import { Request, Response } from "express";
import prisma from "../config/db";
import jwt from "jsonwebtoken";

import {
  createQuotationRepo,
  createQuotationDetailRepo,
  incrementQuotationCounterRepo,
  getQuotationsRepo,
  getQuotationsByCustomerRepo,
} from "../repository/quotation.repository";

// =====================================================
// 🔥 CREATE QUOTATION
// =====================================================

export const createQuotation = async (req: Request, res: Response) => {
  try {
    const {
      locationId,
      products,
      subtotal,
      total,
      name,
      ci,
      phone,
      whatsapp,
      originChannel,
      address,
      latitude,
      longitude,
      businessName,
      notes,
      expiresAt,
    } = req.body;

    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const quotation = await prisma.$transaction(
      async (tx) => {

        //////////////////////////////////////////////////////
        // 🔥 VALIDAR EMPLEADO
        //////////////////////////////////////////////////////

        const employee = await tx.employee.findUnique({
          where: { id: Number(user.id) },
        });

        if (!employee) throw new Error("Empleado no encontrado");

        //////////////////////////////////////////////////////
        // 🔥 CLIENTE
        //////////////////////////////////////////////////////

        let customerId: number | null = null;

        if (req.body.customerId) {
          ////////////////////////////////////////////////////
          // 🔥 CLIENTE YA SELECCIONADO — usar directo
          ////////////////////////////////////////////////////

          customerId = Number(req.body.customerId);

        } else if (ci || name) {
          ////////////////////////////////////////////////////
          // 🔥 CLIENTE NUEVO — buscar o crear
          ////////////////////////////////////////////////////

          let existingCustomer = null;

          if (ci) {
            existingCustomer = await tx.customer.findUnique({
              where: { nitCi: ci },
            });
          }

          if (!existingCustomer) {
            const generateCustomerCode = (length = 8) => {
              const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let result = "";
              for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              return result;
            };

            let customerCode = "";
            let exists = true;
            while (exists) {
              customerCode = generateCustomerCode(8);
              const existingCode = await tx.customer.findUnique({
                where: { code: customerCode },
              });
              exists = !!existingCode;
            }

            existingCustomer = await tx.customer.create({
              data: {
                name,
                code: customerCode,
                nitCi: ci || "S/N",
                businessName: businessName || name,
                phone,
                ...(whatsapp && { whatsapp }),
                ...(originChannel && { originChannel }),
              },
            });

            if (address) {
              await tx.customerAddress.create({
                data: {
                  customerId: existingCustomer.id,
                  address,
                  latitude: latitude ? Number(latitude) : null,
                  longitude: longitude ? Number(longitude) : null,
                  isPrimary: true,
                },
              });
            }
          }

          customerId = existingCustomer.id;
        }

        //////////////////////////////////////////////////////
        // 🔥 INCREMENTAR CONTADOR Y GENERAR CÓDIGO
        //////////////////////////////////////////////////////

        const location = await incrementQuotationCounterRepo(tx, Number(locationId));
        const code = `COT-${location.abbreviation}-${location.quotationCounter}`;

        //////////////////////////////////////////////////////
        // 🔥 DESCUENTO TOTAL
        //////////////////////////////////////////////////////

        const totalDiscount = products.reduce(
          (acc: number, item: any) => acc + Number(item.itemDiscount || 0),
          0,
        );

        //////////////////////////////////////////////////////
        // 🔥 CREAR COTIZACIÓN
        //////////////////////////////////////////////////////

        const newQuotation = await createQuotationRepo(tx, {
          code,
          locationId: Number(locationId),
          employeeId: Number(user.id),
          customerId,
          subtotal: Number(subtotal),
          discount: totalDiscount,
          total: Number(total),
          notes: notes || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          status: "PENDING",
        });

        //////////////////////////////////////////////////////
        // 🔥 DETAILS (sin tocar inventario)
        //////////////////////////////////////////////////////

        for (const item of products) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) throw new Error(`Producto ID ${item.productId} no encontrado`);

          const productUnit = await tx.productUnit.findUnique({
            where: { id: item.productUnitId },
            include: { unit: true },
          });
          if (!productUnit) throw new Error(`Unidad ID ${item.productUnitId} no encontrada`);

          const unitPrice = Number(productUnit.salePrice);
          const itemDiscount = Number(item.itemDiscount || 0);
          const detailSubtotal = unitPrice * Number(item.quantity) - itemDiscount;

          await createQuotationDetailRepo(tx, {
            quotationId: newQuotation.id,
            productId: item.productId,
            productUnitId: item.productUnitId,
            unitName: productUnit.unit.name,
            equivalence: Number(item.equivalence),
            quantity: Number(item.quantity),
            unitPrice,
            itemDiscount,
            subtotal: detailSubtotal,
          });
        }

        //////////////////////////////////////////////////////
        // 🔥 RETORNAR COTIZACIÓN COMPLETA
        //////////////////////////////////////////////////////

        return await tx.quotation.findUnique({
          where: { id: newQuotation.id },
          include: {
            customer: true,
            location: true,
            employee: true,
            details: {
              include: {
                product: true,
                productUnit: { include: { unit: true } },
              },
            },
          },
        });
      },
      { timeout: 15000 },
    );

    return res.json({
      message: "Cotización creada exitosamente",
      quotation,
    });
  } catch (err: any) {
    console.error("❌ ERROR CREATE QUOTATION:", err);
    return res.status(500).json({
      message: err.message || "No se pudo crear la cotización",
    });
  }
};

// =====================================================
// 🔥 GET QUOTATIONS
// =====================================================

export const getQuotations = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;
    const isManagement = user.level === 1 || user.level === 4;

    const data = await getQuotationsRepo(Number(user.locationId), isManagement);
    return res.json(data);
  } catch (error) {
    console.error("❌ ERROR GET QUOTATIONS:", error);
    return res.status(500).json({
      message: "No se pudieron obtener las cotizaciones",
    });
  }
};

// =====================================================
// 🔥 UPDATE QUOTATION STATUS
// =====================================================

export const updateQuotationStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: Number(id) },
    });

    if (!quotation) {
      return res.status(404).json({ error: "Cotización no encontrada" });
    }

    if (quotation.status === "APPROVED") {
      return res.status(400).json({ error: "La cotización ya fue aprobada" });
    }

    if (quotation.status === "REJECTED") {
      return res.status(400).json({ error: "La cotización ya fue rechazada" });
    }

    const updated = await prisma.quotation.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        customer: true,
        location: { select: { name: true } },
        employee: { select: { name: true, lastName: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, code: true } },
            productUnit: { include: { unit: true } },
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("❌ ERROR UPDATE QUOTATION STATUS:", error);
    return res.status(500).json({ error: "Error al actualizar estado de cotización" });
  }
};

// =====================================================
// 🔥 CONVERT QUOTATION TO SALE
// =====================================================

export const convertQuotationToSale = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metodoPago, codigoTransaccion, bankName, generateInvoice } = req.body;

  const token = req.headers["x-access-token"] as string;
  const user = jwt.verify(token, process.env.JWTSECRET!) as any;

  try {
    const sale = await prisma.$transaction(
      async (tx) => {

        //////////////////////////////////////////////////////
        // 🔥 OBTENER COTIZACIÓN
        //////////////////////////////////////////////////////

        const quotation = await tx.quotation.findUnique({
          where: { id: Number(id) },
          include: { details: true },
        });

        if (!quotation) throw new Error("Cotización no encontrada");
        if (quotation.status === "APPROVED") throw new Error("La cotización ya fue convertida a venta");
        if (quotation.status === "REJECTED") throw new Error("No se puede convertir una cotización rechazada");

        //////////////////////////////////////////////////////
        // 🔥 VALIDAR STOCK
        //////////////////////////////////////////////////////

        for (const item of quotation.details) {
          const inventory = await tx.inventory.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: quotation.locationId,
              },
            },
          });

          const realQuantity = Number(item.quantity) * Number(item.equivalence);

          if (!inventory || inventory.quantity < realQuantity) {
            throw new Error(
              `Stock insuficiente para producto ID ${item.productId}. Disponible: ${inventory?.quantity || 0}`,
            );
          }
        }

        //////////////////////////////////////////////////////
        // 🔥 INCREMENTAR CONTADOR Y GENERAR CÓDIGO
        //////////////////////////////////////////////////////

        const location = await tx.location.update({
          where: { id: quotation.locationId },
          data: { saleCounter: { increment: 1 } },
        });

        const code = `${location.abbreviation}-${location.saleCounter}`;

        //////////////////////////////////////////////////////
        // 🔥 CREAR VENTA
        //////////////////////////////////////////////////////

        const newSale = await tx.sale.create({
          data: {
            employeeId: Number(user.id),
            locationId: quotation.locationId,
            customerId: quotation.customerId,
            subtotal: quotation.subtotal,
            discount: quotation.discount,
            total: quotation.total,
            code,
            pdfUrl: `MEGADIS/SALES/${code}.pdf`,
            typeSale: metodoPago,
            bankName: bankName || null,
            transactionNumber: codigoTransaccion || null,
            generateInvoice: generateInvoice || false,
            quotationId: quotation.id,
          },
        });

        //////////////////////////////////////////////////////
        // 🔥 DETAILS + INVENTARIO + KARDEX
        //////////////////////////////////////////////////////

        for (const item of quotation.details) {
          const inventory = await tx.inventory.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: quotation.locationId,
              },
            },
          });

          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          const realQuantity = Number(item.quantity) * Number(item.equivalence);

          await tx.saleDetail.create({
            data: {
              saleId: newSale.id,
              productId: item.productId,
              productUnitId: item.productUnitId,
              unitName: item.unitName,
              equivalence: item.equivalence,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              itemDiscount: item.itemDiscount,
              subtotal: item.subtotal,
            },
          });

          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: quotation.locationId,
              },
            },
            data: { quantity: { decrement: realQuantity } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              productUnitId: item.productUnitId,
              fromLocationId: quotation.locationId,
              quantity: realQuantity,
              presentationQuantity: item.quantity,
              type: "OUT",
              unitCost: inventory!.averageCost || product!.purchasePrice,
              reference: `VENTA ${code} (COT: ${quotation.code})`,
            },
          });
        }

        //////////////////////////////////////////////////////
        // 🔥 MARCAR COTIZACIÓN COMO APROBADA
        //////////////////////////////////////////////////////

        await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: "APPROVED" },
        });

        //////////////////////////////////////////////////////
        // 🔥 RETORNAR VENTA COMPLETA
        //////////////////////////////////////////////////////

        return await tx.sale.findUnique({
          where: { id: newSale.id },
          include: {
            customer: true,
            location: true,
            employee: true,
            details: {
              include: {
                product: true,
                productUnit: { include: { unit: true } },
              },
            },
          },
        });
      },
      { timeout: 15000 },
    );

    return res.json({
      message: "Cotización convertida a venta exitosamente",
      sale,
    });
  } catch (err: any) {
    console.error("❌ ERROR CONVERT QUOTATION:", err);
    return res.status(500).json({
      message: err.message || "No se pudo convertir la cotización",
    });
  }
};

export const getQuotationsByCustomer = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const data = await getQuotationsByCustomerRepo(Number(customerId));
    return res.json(data);
  } catch (error) {
    console.error("❌ ERROR GET QUOTATIONS BY CUSTOMER:", error);
    return res.status(500).json({
      message: "No se pudieron obtener las cotizaciones del cliente",
    });
  }
};