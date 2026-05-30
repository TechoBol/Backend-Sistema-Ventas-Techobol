import { Request, Response } from "express";
import prisma from "../config/db";

import {
  createSaleRepo,
  createSaleDetailRepo,
  getInventoryRepo,
  updateInventoryRepo,
  incrementLocationCounterRepo,
  getProductRepo,
  getSalesRepo,
  createStockMovementRepo,
  getProductUnitRepo,
} from "../repository/sale.repository";

import jwt from "jsonwebtoken";

// =====================================================
// 🔥 CREATE SALE
// =====================================================

export const createSale = async (req: Request, res: Response) => {
  console.log("BODY COMPLETO:");
  console.log(req.body);
  try {
    const {
      locationId,
      products,
      codigoTransaccion,
      metodoPago,
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
      generateInvoice,
      bankName,
      businessName,
      occupation, // 👈 agregado
    } = req.body;

    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const sale = await prisma.$transaction(
      async (tx) => {

        //////////////////////////////////////////////////////
        // 🔥 VALIDAR STOCK
        //////////////////////////////////////////////////////

        for (const item of products) {
          const inventory = await getInventoryRepo(tx, item.productId, locationId);
          const realQuantity = Number(item.quantity) * Number(item.equivalence);

          if (!inventory || inventory.quantity < realQuantity) {
            throw new Error(
              `Stock insuficiente para producto ID ${item.productId}. Disponible: ${inventory?.quantity || 0}`,
            );
          }
        }

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
        let customerAddressId: number | null = null;

        if (req.body.customerId) {
          ////////////////////////////////////////////////////
          // CASO 1: Cliente ya seleccionado — actualizar datos
          ////////////////////////////////////////////////////

          customerId = Number(req.body.customerId);

          await tx.customer.update({
            where: { id: customerId },
            data: {
              ...(name && { name }),
              ...(phone && { phone }),
              ...(whatsapp && { whatsapp }),
              ...(originChannel && { originChannel }),
              ...(occupation && { occupation }),
            },
          });

          if (address) {
            const existingAddress = await tx.customerAddress.findFirst({
              where: { customerId, address },
            });

            if (!existingAddress) {
              const newAddress = await tx.customerAddress.create({
                data: {
                  customerId,
                  address,
                  latitude: latitude ? Number(latitude) : null,
                  longitude: longitude ? Number(longitude) : null,
                },
              });
              customerAddressId = newAddress.id;
            } else {
              customerAddressId = existingAddress.id;
            }
          }

        } else if (ci || name) {
          ////////////////////////////////////////////////////
          // CASO 2: Sin customerId — buscar por CI o crear
          ////////////////////////////////////////////////////

          let existingCustomer = null;

          if (ci) {
            existingCustomer = await tx.customer.findUnique({
              where: { nitCi: ci },
            });
          }

          if (!existingCustomer) {
            //////////////////////////////////////////////////
            // CASO 2A: Cliente nuevo — crear
            //////////////////////////////////////////////////

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

            console.log({
              ci,
              nitCiToSave: ci || "S/N"
            });

            existingCustomer = await tx.customer.create({
              data: {
                name,
                code: customerCode,
                nitCi: ci || "S/N",
                businessName: businessName || name,
                phone,
                ...(whatsapp && { whatsapp }),
                ...(originChannel && { originChannel }),
                ...(occupation && { occupation }),
              },
            });

            if (address) {
              const newAddress = await tx.customerAddress.create({
                data: {
                  customerId: existingCustomer.id,
                  address,
                  latitude: latitude ? Number(latitude) : null,
                  longitude: longitude ? Number(longitude) : null,
                  isPrimary: true,
                },
              });
              customerAddressId = newAddress.id;
            }

          } else {
            //////////////////////////////////////////////////
            // CASO 2B: Cliente encontrado por CI — actualizar
            //////////////////////////////////////////////////

            await tx.customer.update({
              where: { id: existingCustomer.id },
              data: {
                ...(name && { name }),
                ...(phone && { phone }),
                ...(whatsapp && { whatsapp }),
                ...(originChannel && { originChannel }),
                ...(occupation && { occupation }),
              },
            });

            if (address) {
              const existingAddress = await tx.customerAddress.findFirst({
                where: { customerId: existingCustomer.id, address },
              });

              if (!existingAddress) {
                const newAddress = await tx.customerAddress.create({
                  data: {
                    customerId: existingCustomer.id,
                    address,
                    latitude: latitude ? Number(latitude) : null,
                    longitude: longitude ? Number(longitude) : null,
                  },
                });
                customerAddressId = newAddress.id;
              } else {
                customerAddressId = existingAddress.id;
              }
            }
          }

          customerId = existingCustomer.id;
        }

        //////////////////////////////////////////////////////
        // 🔥 INCREMENTAR CONTADOR Y GENERAR CÓDIGO
        //////////////////////////////////////////////////////

        const location = await incrementLocationCounterRepo(tx, locationId);
        const saleNumber = location.saleCounter;
        const code = `${location.abbreviation}-${saleNumber}`;

        //////////////////////////////////////////////////////
        // 🔥 DESCUENTO TOTAL
        //////////////////////////////////////////////////////

        const totalDiscount = products.reduce(
          (acc: number, item: any) => acc + Number(item.itemDiscount || 0),
          0,
        );

        //////////////////////////////////////////////////////
        // 🔥 CREAR VENTA
        //////////////////////////////////////////////////////

        const newSale = await createSaleRepo(tx, {
          employeeId: Number(user.id),
          locationId,
          customerId,
          customerAddressId,
          customerAddressSnapshot: address || null,
          customerLatitudeSnapshot: latitude ? Number(latitude) : null,
          customerLongitudeSnapshot: longitude ? Number(longitude) : null,
          subtotal,
          discount: totalDiscount,
          total: Number(total),
          code,
          pdfUrl: `MEGADIS/SALES/${code}.pdf`,
          typeSale: metodoPago,
          bankName: bankName || null,
          transactionNumber: codigoTransaccion || null,
          generateInvoice: generateInvoice || false,
        });

        //////////////////////////////////////////////////////
        // 🔥 DETAILS + INVENTARIO + KARDEX
        //////////////////////////////////////////////////////

        for (const item of products) {
          const product = await getProductRepo(tx, item.productId);
          if (!product) throw new Error(`Producto ID ${item.productId} no encontrado`);

          const productUnit = await getProductUnitRepo(tx, item.productUnitId);
          if (!productUnit) throw new Error(`Unidad ID ${item.productUnitId} no encontrada`);

          const inventory = await getInventoryRepo(tx, item.productId, locationId);
          if (!inventory) throw new Error(`Inventario no encontrado para producto ID ${item.productId}`);

          const realQuantity = Number(item.quantity) * Number(item.equivalence);
          const unitPrice = Number(productUnit.salePrice);
          const itemDiscount = Number(item.itemDiscount || 0);
          const detailSubtotal = unitPrice * Number(item.quantity) - itemDiscount;

          await createSaleDetailRepo(tx, {
            saleId: newSale.id,
            productId: item.productId,
            productUnitId: item.productUnitId,
            unitName: productUnit.unit.name,
            equivalence: Number(item.equivalence),
            quantity: Number(item.quantity),
            unitPrice,
            itemDiscount,
            subtotal: detailSubtotal,
          });

          await updateInventoryRepo(tx, item.productId, locationId, realQuantity);

          await createStockMovementRepo(tx, {
            productId: item.productId,
            productUnitId: item.productUnitId,
            fromLocationId: locationId,
            quantity: realQuantity,
            presentationQuantity: Number(item.quantity),
            type: "OUT",
            unitCost: inventory.averageCost || product.purchasePrice,
            reference: `VENTA ${code}`,
          });
        }

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
      message: "Venta completada",
      sale,
    });
  } catch (err: any) {
    console.error("❌ ERROR CREATE SALE:", err);
    return res.status(500).json({
      message: err.message || "No se pudo procesar la operación de la venta",
    });
  }
};

// =====================================================
// 🔥 GET SALES
// =====================================================

export const getSales = async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const user = jwt.verify(token, process.env.JWTSECRET!) as any;
    const isManagement = user.level === 1 || user.level === 4;
    const data = await getSalesRepo(Number(user.locationId), isManagement);
    return res.json(data);
  } catch (error) {
    console.error("❌ ERROR GET SALES:", error);
    return res.status(500).json({
      message: "No se pudieron obtener las ventas",
    });
  }
};

// =====================================================
// 🔥 UPDATE PAYMENT METHOD
// =====================================================

export const updateSalePaymentMethod = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metodoPago } = req.body;

  try {
    const sale = await prisma.sale.findUnique({ where: { id: Number(id) } });

    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    if (sale.paymentMethodChanged) {
      return res.status(400).json({ error: "El método de pago ya fue cambiado anteriormente" });
    }

    const updated = await prisma.sale.update({
      where: { id: Number(id) },
      data: {
        typeSale: metodoPago,
        paymentMethodChanged: true,
      },
      include: {
        customer: true,
        location: { select: { name: true } },
        employee: { select: { name: true, lastName: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar método de pago" });
  }
};

// =====================================================
// 🔥 UPDATE SALE DATE
// =====================================================

export const updateSaleDate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date } = req.body;

  try {
    const sale = await prisma.sale.findUnique({ where: { id: Number(id) } });

    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    if (sale.dateChanged) {
      return res.status(400).json({ error: "La fecha ya fue modificada anteriormente" });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Fecha inválida" });
    }

    const updated = await prisma.sale.update({
      where: { id: Number(id) },
      data: {
        date: parsedDate,
        dateChanged: true,
      },
      include: {
        customer: true,
        location: { select: { name: true } },
        employee: { select: { name: true, lastName: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar la fecha" });
  }
};