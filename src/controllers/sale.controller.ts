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
  try {
    const {
      locationId,
      products,
      codigoTransaccion,
      metodoPago,
      subtotal,
      total,
      customer,
    } = req.body;

    const token = req.headers["x-access-token"] as string;

    const user = jwt.verify(token, process.env.JWTSECRET!) as any;

    const sale = await prisma.$transaction(
      async (tx) => {
        //////////////////////////////////////////////////////
        // 🔥 VALIDAR STOCK
        //////////////////////////////////////////////////////

        for (const item of products) {
          const inventory = await getInventoryRepo(
            tx,
            item.productId,
            locationId,
          );

          const realQuantity =
            Number(item.quantity) *
            Number(item.equivalence);

          if (!inventory || inventory.quantity < realQuantity) {
            throw new Error(
              `Stock insuficiente para producto ${item.productId}`,
            );
          }
        }

        //////////////////////////////////////////////////////
        // 🔥 VALIDAR EMPLEADO
        //////////////////////////////////////////////////////

        const employee = await tx.employee.findUnique({
          where: {
            id: Number(user.id),
          },
        });

        if (!employee) {
          throw new Error("Empleado no encontrado");
        }

        //////////////////////////////////////////////////////
        // 🔥 CLIENTE
        //////////////////////////////////////////////////////

        let customerId: number | null = null;

        if (customer?.nitCi) {
          const existingCustomer = await tx.customer.findUnique({
            where: {
              nitCi: customer.nitCi,
            },
          });

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const generateCustomerCode = (length = 8) => {
              const chars =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

              let result = "";

              for (let i = 0; i < length; i++) {
                result += chars.charAt(
                  Math.floor(Math.random() * chars.length),
                );
              }

              return result;
            };

            let customerCode = "";

            let exists = true;

            while (exists) {
              customerCode = generateCustomerCode(8);

              const existingCode = await tx.customer.findUnique({
                where: {
                  code: customerCode,
                },
              });

              exists = !!existingCode;
            }

            const newCustomer = await tx.customer.create({
              data: {
                name: customer.name,

                code: customerCode,

                nitCi: customer.nitCi,

                businessName: customer.businessName,

                phone: customer.phone,

                address: customer.address,

                latitude: customer.latitude,

                longitude: customer.longitude,
              },
            });

            customerId = newCustomer.id;
          }
        }

        //////////////////////////////////////////////////////
        // 🔥 INCREMENTAR CONTADOR
        //////////////////////////////////////////////////////

        const location = await incrementLocationCounterRepo(
          tx,
          locationId,
        );

        const saleNumber = location.saleCounter;

        const code = `${location.abbreviation}-${saleNumber}`;

        //////////////////////////////////////////////////////
        // 🔥 DESCUENTO TOTAL
        //////////////////////////////////////////////////////

        const totalDiscount = products.reduce(
          (acc: number, item: any) =>
            acc + Number(item.itemDiscount || 0),
          0,
        );

        //////////////////////////////////////////////////////
        // 🔥 CREAR SALE
        //////////////////////////////////////////////////////

        const newSale = await createSaleRepo(tx, {
          employeeId: Number(user.id),

          locationId,

          customerId,

          subtotal,

          discount: totalDiscount,

          total,

          code,

          pdfUrl: `MEGADIS/SALES/${code}.pdf`,

          typeSale: metodoPago,

          transactionNumber: codigoTransaccion,
        });

        //////////////////////////////////////////////////////
        // 🔥 DETAILS + INVENTARIO + MOVIMIENTOS
        //////////////////////////////////////////////////////

        for (const item of products) {
          const product = await getProductRepo(
            tx,
            item.productId,
          );

          if (!product) {
            throw new Error("Producto no encontrado");
          }

          const productUnit = await getProductUnitRepo(
            tx,
            item.productUnitId,
          );

          if (!productUnit) {
            throw new Error("Unidad no encontrada");
          }

          const inventory = await getInventoryRepo(
            tx,
            item.productId,
            locationId,
          );

          if (!inventory) {
            throw new Error("Inventario no encontrado");
          }

          ////////////////////////////////////////////////////
          // 🔥 CANTIDAD REAL
          ////////////////////////////////////////////////////

          const realQuantity =
            Number(item.quantity) *
            Number(item.equivalence);

          ////////////////////////////////////////////////////
          // 🔥 PRECIOS
          ////////////////////////////////////////////////////

          const unitPrice = Number(productUnit.salePrice);

          const itemDiscount = Number(
            item.itemDiscount || 0,
          );

          const detailSubtotal =
            unitPrice * Number(item.quantity) -
            itemDiscount;

          ////////////////////////////////////////////////////
          // 🔥 SALE DETAIL
          ////////////////////////////////////////////////////

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

          ////////////////////////////////////////////////////
          // 🔥 INVENTARIO
          ////////////////////////////////////////////////////

          await updateInventoryRepo(
            tx,
            item.productId,
            locationId,
            realQuantity,
          );

          ////////////////////////////////////////////////////
          // 🔥 KARDEX
          ////////////////////////////////////////////////////

          await createStockMovementRepo(tx, {
            productId: item.productId,

            productUnitId: item.productUnitId,

            fromLocationId: locationId,

            quantity: realQuantity,

            presentationQuantity: Number(item.quantity),

            type: "OUT",

            unitCost:
              inventory.averageCost ||
              product.purchasePrice,

            reference: `VENTA ${code}`,
          });
        }

        //////////////////////////////////////////////////////
        // 🔥 OBTENER SALE COMPLETA
        //////////////////////////////////////////////////////

        return await tx.sale.findUnique({
          where: {
            id: newSale.id,
          },

          include: {
            customer: true,

            location: true,

            employee: true,

            details: {
              include: {
                product: true,

                productUnit: {
                  include: {
                    unit: true,
                  },
                },
              },
            },
          },
        });
      },

      {
        timeout: 15000,
      },
    );

    return res.json({
      message: "Venta completada",

      sale,
    });
  } catch (err: any) {
    console.error("❌ ERROR CREATE SALE:", err);

    return res.status(500).json({
      message: err.message || "No se pudo crear la venta",
    });
  }
};

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

export const updateSalePaymentMethod = async (req: Request, res: Response) => {
  const { id } = req.params;

  const { metodoPago } = req.body;

  try {
    const sale = await prisma.sale.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!sale) {
      return res.status(404).json({
        error: "Venta no encontrada",
      });
    }

    if (sale.paymentMethodChanged) {
      return res.status(400).json({
        error: "El método de pago ya fue cambiado anteriormente",
      });
    }

    const updated = await prisma.sale.update({
      where: {
        id: Number(id),
      },

      data: {
        typeSale: metodoPago,

        paymentMethodChanged: true,
      },

      include: {
        customer: true,

        location: {
          select: {
            name: true,
          },
        },

        employee: {
          select: {
            name: true,
            lastName: true,
          },
        },

        details: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({
      error: "Error al actualizar método de pago",
    });
  }
};

export const updateSaleDate = async (req: Request, res: Response) => {
  const { id } = req.params;

  const { date } = req.body;

  try {
    const sale = await prisma.sale.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!sale) {
      return res.status(404).json({
        error: "Venta no encontrada",
      });
    }

    if (sale.dateChanged) {
      return res.status(400).json({
        error: "La fecha ya fue modificada anteriormente",
      });
    }

    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: "Fecha inválida",
      });
    }

    const updated = await prisma.sale.update({
      where: {
        id: Number(id),
      },

      data: {
        date: parsedDate,

        dateChanged: true,
      },

      include: {
        customer: true,

        location: {
          select: {
            name: true,
          },
        },

        employee: {
          select: {
            name: true,
            lastName: true,
          },
        },

        details: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({
      error: "Error al actualizar la fecha",
    });
  }
};
