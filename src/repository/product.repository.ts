import prisma from "../config/db";

type CreateProductDTO = {
  name: string;
  description?: string;
  code: string;
  imageUrl?: string;
  price: number;
  finalPrice: number;
  lineId: number;
  brandName: string;
};

export const createProductRepo = async (data: CreateProductDTO) => {
  return prisma.product.create({
    data,
  });
};

export const getProductsRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  if (isManagement) {
    const products = await prisma.product.findMany({
      where: { isVisible: true },
      include: {
        line: true,
        inventories: {
          include: {
            location: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return products
      .map((p) => ({
        ...p,
        stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
        inventories: p.inventories.map((inv) => ({
          locationId: inv.locationId,
          locationName: inv.location.name,
          quantity: inv.quantity,
        })),
      }))
      .sort((a, b) => b.stockTotal - a.stockTotal);
  }

  const products = await prisma.product.findMany({
    where: { isVisible: true },
    include: {
      line: true,
      inventories: {
        where: { locationId },
      },
    },
  });

  return products.sort((a, b) => {
    const stockA = a.inventories[0]?.quantity || 0;
    const stockB = b.inventories[0]?.quantity || 0;
    return stockB - stockA;
  });
};

export const getProductByIdRepo = async (id: number) => {
  return prisma.product.findUnique({
    where: { id },
    include: {
      line: true,
      inventories: true,
    },
  });
};

export const updateProductRepo = async (id: number, data: any) => {
  const { stock, locationId, inventoryEdited, ...productData } = data;

  return prisma.$transaction(async (tx) => {
    const currentProduct = await tx.product.findUnique({
      where: { id },
    });

    if (!currentProduct) {
      throw new Error("Producto no encontrado");
    }

    await tx.product.update({
      where: { id },
      data: {
        name: productData.name,
        description: productData.description,
        code: productData.code,
        price: productData.price,
        finalPrice: productData.finalPrice,
        imageUrl: productData.imageUrl,
        lineId: productData.lineId,
        brandName: productData.brandName,
      },
    });
    if (inventoryEdited) {
      if (stock !== undefined && locationId) {
        const inventory = await tx.inventory.findUnique({
          where: {
            productId_locationId: {
              productId: id,
              locationId,
            },
          },
        });

        if (!inventory) {
          await tx.inventory.create({
            data: {
              productId: id,
              locationId,

              quantity: stock,

              averageCost: productData.price,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: id,

              toLocationId: locationId,

              quantity: stock,

              type: "IN",

              unitCost: productData.price,

              reference: "NUEVO INGRESO",
            },
          });
        } else {
          const cantidadActual = inventory.quantity;

          const costoActual = inventory.averageCost;

          const totalActual = cantidadActual * costoActual;

          const totalNuevo = stock * productData.price;

          const nuevaCantidad = cantidadActual + stock;

          const nuevoPromedio =
            nuevaCantidad > 0
              ? (totalActual + totalNuevo) / nuevaCantidad
              : productData.price;

          await tx.inventory.update({
            where: {
              productId_locationId: {
                productId: id,
                locationId,
              },
            },

            data: {
              quantity: {
                increment: stock,
              },

              averageCost: nuevoPromedio,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: id,

              toLocationId: locationId,

              quantity: stock,

              type: "IN",

              unitCost: productData.price,

              reference: "REPOSICION STOCK",
            },
          });
        }
      }
    }

    return tx.product.findUnique({
      where: { id },
      include: {
        line: true,
        inventories: {
          include: {
            location: true,
          },
        },
      },
    });
  });
};

export const deleteProductRepo = async (id: number) => {
  return prisma.product.update({
    where: { id },
    data: { isVisible: false },
  });
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
  console.log("📥 INPUT:", {
    productId,
    fromDate,
    toDate,
    locationId,
  });

  const parseDate = (dateStr?: string, end = false) => {
    if (!dateStr) return null;

    const d = new Date(end ? `${dateStr}T23:59:59` : `${dateStr}T00:00:00`);

    return isNaN(d.getTime()) ? null : d;
  };

  const from = parseDate(fromDate);
  const to = parseDate(toDate, true);

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,

      ...(productId && {
        id: productId,
      }),

      ...(linea && {
        lineId: linea,
      }),

      ...(marca &&
        marca.trim() !== "" && {
          brandName: {
            contains: marca,
            mode: "insensitive",
          },
        }),
    },

    include: {
      line: true,
    },
  });

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(productId && {
        productId,
      }),

      ...(locationId && {
        OR: [
          {
            fromLocationId: locationId,
          },
          {
            toLocationId: locationId,
          },
        ],
      }),

      ...(from &&
        to && {
          createdAt: {
            gte: from,
            lte: to,
          },
        }),
    },

    include: {
      product: {
        include: {
          line: true,
        },
      },

      transfer: true,
      fromLocation: true,
      toLocation: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const resultado: any[] = [];

  for (const product of products) {
    const inventory = await prisma.inventory.findMany({
      where: {
        productId: product.id,

        ...(locationId && {
          locationId,
        }),
      },
    });

    const stockActual = inventory.reduce((acc, inv) => acc + inv.quantity, 0);

    const inventoryCost =
      inventory.length > 0
        ? inventory.reduce((acc, inv) => acc + inv.averageCost, 0) /
          inventory.length
        : product.price;

    const movimientosProducto: any[] = [];

    for (const mov of movements.filter((m) => m.productId === product.id)) {
      let entrada = 0;
      let salida = 0;

      let detalle = "";

      let codigoMovimiento = "";

      if (mov.type === "IN") {
        entrada = mov.quantity;

        detalle = (mov.reference || "COMPRA / IMPORTACIÓN").toUpperCase();
      }

      if (mov.type === "OUT") {
        salida = mov.quantity;

        detalle = (mov.reference || "SALIDA").toUpperCase();
      }

      if (mov.type === "TRANSFER") {
        const transferCode = mov.transfer?.transferCode || `TR-${mov.id}`;

        const fromName = mov.fromLocation?.name?.toUpperCase() || "ORIGEN";

        const toName = mov.toLocation?.name?.toUpperCase() || "DESTINO";

        codigoMovimiento = transferCode;

        if (locationId) {
          if (mov.toLocationId === locationId) {
            entrada = mov.quantity;

            detalle = (
              `TRANSFERENCIA ENTRADA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase();
          }

          if (mov.fromLocationId === locationId) {
            salida = mov.quantity;

            detalle = (
              `TRANSFERENCIA SALIDA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase();
          }
        } else {
          movimientosProducto.push({
            fecha: mov.createdAt,

            codigoMovimiento: transferCode,

            detalle: (
              `TRANSFERENCIA SALIDA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase(),

            entrada: 0,
            salida: mov.quantity,

            costoUnitario: mov.unitCost || 0,
          });

          movimientosProducto.push({
            fecha: mov.createdAt,

            codigoMovimiento: transferCode,

            detalle: (
              `TRANSFERENCIA ENTRADA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase(),

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

    movimientosProducto.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    if (movimientosProducto.length === 0) {
      resultado.push({
        producto: product.name,

        code: product.code,

        linea: product.line?.name || "-",

        marca: product.brandName || "-",

        kardex: [
          {
            fecha: new Date(),

            codigoMovimiento: "",

            detalle: "SIN MOVIMIENTOS",

            entrada: 0,
            salida: 0,

            saldoCantidad: stockActual,

            costoUnitario: inventoryCost,

            entradaTotal: 0,

            salidaTotal: 0,

            saldoTotal: stockActual * inventoryCost,
          },
        ],
      });

      continue;
    }

    let saldoCantidad = 0;

    let saldoTotal = 0;

    let costoPromedio = 0;

    const kardexProducto: any[] = [];

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

      code: product.code,

      linea: product.line?.name || "-",

      marca: product.brandName || "-",

      kardex: kardexProducto,
    });
  }

  console.log("Kardex generado:", resultado.length, "productos");

  return resultado;
};

export const getKardexRepository = async (filters: any) => {
  const { sucursal, item, marca, linea, vendedor, fromDate, toDate } = filters;

  const sales = await prisma.saleDetail.findMany({
    where: {
      sale: {
        date: {
          gte: fromDate ? new Date(fromDate) : undefined,

          lte: toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined,
        },

        locationId: sucursal ? Number(sucursal) : undefined,

        employeeId: vendedor ? Number(vendedor) : undefined,
      },

      product: {
        name: item
          ? {
              contains: item,
              mode: "insensitive",
            }
          : undefined,

        brandName: marca
          ? {
              contains: marca,
              mode: "insensitive",
            }
          : undefined,

        lineId: linea ? Number(linea) : undefined,
      },
    },

    include: {
      product: {
        include: {
          line: true,
        },
      },
    },
  });

  const grouped: any = {};

  sales.forEach((item) => {
    const key = item.product.id;

    if (!grouped[key]) {
      grouped[key] = {
        id: item.product.id,

        product: item.product.name,

        line: item.product.line?.name || "",

        brand: item.product.brandName || "",

        quantity: 0,

        total: 0,
      };
    }

    grouped[key].quantity += item.quantity;

    grouped[key].total += item.quantity * item.price;
  });

  return Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
};
