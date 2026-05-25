import prisma from "../config/db";

//////////////////////////////////////////////////////////
// GET PRODUCTS
//////////////////////////////////////////////////////////

export const getProductsRepo = async (
  locationId: number,
  isManagement: boolean,
) => {
  if (isManagement) {
    const products = await prisma.product.findMany({
      where: {
        isVisible: true,
      },

      include: {
        line: true,

        baseUnit: true,

        productUnits: {
          include: {
            unit: true,
          },
        },

        inventories: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return products.map((p) => ({
      ...p,

      stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
    }));
  }

  const products = await prisma.product.findMany({
    where: {
      isVisible: true,
    },

    include: {
      line: true,

      baseUnit: true,

      productUnits: {
        include: {
          unit: true,
        },
      },

      inventories: {
        where: {
          locationId,
        },

        include: {
          location: true,
        },
      },
    },
  });

  return products.map((p) => ({
    ...p,

    stockTotal: p.inventories.reduce((acc, inv) => acc + inv.quantity, 0),
  }));
};

//////////////////////////////////////////////////////////
// GET PRODUCT BY ID
//////////////////////////////////////////////////////////

export const getProductByIdRepo = async (id: number) => {
  return prisma.product.findUnique({
    where: {
      id,
    },

    include: {
      line: true,

      baseUnit: true,

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
};

//////////////////////////////////////////////////////////
// UPDATE PRODUCT
//////////////////////////////////////////////////////////

export const updateProductRepo = async (id: number, data: any) => {
  const {
    productUnits = [],
    applyStockUpdate = false,
    stock = 0,
    averageCost = 0,
    locationId,
    ...productData
  } = data;

  const locId = Number(locationId);

  if (!locId) {
    throw new Error("locationId es requerido");
  }

  return prisma.$transaction(async (tx) => {
    //////////////////////////////////////////////////////
    // VALIDAR DEFAULT
    //////////////////////////////////////////////////////
    const defaultUnits = productUnits.filter((x: any) => x.isDefault);

    if (defaultUnits.length !== 1) {
      throw new Error("Debe existir una presentación por defecto");
    }

    const defaultPresentation = defaultUnits[0];

    //////////////////////////////////////////////////////
    // UNIDAD BASE
    //////////////////////////////////////////////////////
    const baseUnit = await tx.unit.findUnique({
      where: { code: productData.baseUnitCode },
    });

    if (!baseUnit) {
      throw new Error("Unidad base inválida");
    }

    //////////////////////////////////////////////////////
    // INVENTARIO (CORRECTO: UNIQUE)
    //////////////////////////////////////////////////////
    const inventory = await tx.inventory.findUnique({
      where: {
        productId_locationId: {
          productId: id,
          locationId: locId,
        },
      },
    });

    if (!inventory) {
      throw new Error("Inventario no encontrado");
    }

    //////////////////////////////////////////////////////
    // STOCK + COSTO PROMEDIO (CORRECTO)
    //////////////////////////////////////////////////////
    const oldStock = Number(inventory.quantity);
    const oldCost = Number(inventory.averageCost);

    const newStock = Number(stock);
    const newCost = Number(averageCost);

    let finalStock = oldStock;
    let finalAverageCost = oldCost;

    if (applyStockUpdate && newStock > 0) {
      const totalStock = oldStock + newStock;

      finalStock = totalStock;

      finalAverageCost =
        totalStock > 0
          ? (oldStock * oldCost + newStock * newCost) / totalStock
          : 0;
    }

    //////////////////////////////////////////////////////
    // UNIDADES
    //////////////////////////////////////////////////////
    const unitCodes = productUnits.map((u: any) =>
      u.unitCode.trim().toUpperCase(),
    );

    const units = await tx.unit.findMany({
      where: {
        code: { in: unitCodes },
      },
    });

    if (units.length !== unitCodes.length) {
      throw new Error("Existen unidades inválidas");
    }

    const unitMap = new Map(
      units.map((u) => [u.code.toUpperCase(), u]),
    );

    //////////////////////////////////////////////////////
    // ACTUALIZAR PRODUCTO
    //////////////////////////////////////////////////////
    await tx.product.update({
      where: { id },
      data: {
        name: productData.name?.trim()?.toUpperCase(),
        description: productData.description,
        code: productData.code?.trim(),
        lineId: Number(productData.lineId),
        brandName: productData.brandName,
        baseUnitId: baseUnit.id,
        purchasePrice: finalAverageCost,
        salePrice: Number(defaultPresentation.salePrice),
      },
    });

    //////////////////////////////////////////////////////
    // UPSERT PRODUCT UNITS (SIN DELETE)
    //////////////////////////////////////////////////////
    const existingUnits = await tx.productUnit.findMany({
      where: { productId: id },
    });

    const existingMap = new Map(
      existingUnits.map((u) => [u.unitId, u]),
    );

    for (const item of productUnits) {
      const unit = unitMap.get(
        item.unitCode.trim().toUpperCase(),
      );

      if (!unit) {
        throw new Error(`Unidad no encontrada: ${item.unitCode}`);
      }

      const existing = existingMap.get(unit.id);

      if (existing) {
        await tx.productUnit.update({
          where: { id: existing.id },
          data: {
            equivalence: Number(item.equivalence),
            salePrice: Number(item.salePrice),
            purchasePrice: finalAverageCost,
            isDefault: item.isDefault || false,
          },
        });
      } else {
        await tx.productUnit.create({
          data: {
            productId: id,
            unitId: unit.id,
            equivalence: Number(item.equivalence),
            salePrice: Number(item.salePrice),
            purchasePrice: finalAverageCost,
            isDefault: item.isDefault || false,
          },
        });
      }
    }

    //////////////////////////////////////////////////////
    // INVENTARIO UPDATE
    //////////////////////////////////////////////////////
    await tx.inventory.update({
      where: {
        productId_locationId: {
          productId: id,
          locationId: locId,
        },
      },
      data: {
        quantity: finalStock,
        averageCost: finalAverageCost,
      },
    });

    //////////////////////////////////////////////////////
    // MOVIMIENTO (IMPORTACIÓN)
    //////////////////////////////////////////////////////
    const defaultUnit = await tx.productUnit.findFirst({
      where: {
        productId: id,
        isDefault: true,
      },
    });

    if (applyStockUpdate && newStock > 0 && defaultUnit) {
      await tx.stockMovement.create({
        data: {
          productId: id,
          productUnitId: defaultUnit.id,
          toLocationId: locId,
          quantity: newStock,
          presentationQuantity: newStock,
          type: "IN",
          unitCost: newCost,
          reference: "IMPORTACIÓN",
        },
      });
    }

    //////////////////////////////////////////////////////
    // RETURN FINAL
    //////////////////////////////////////////////////////
    return tx.product.findUnique({
      where: { id },
      include: {
        line: true,
        baseUnit: true,
        productUnits: {
          include: { unit: true },
        },
        inventories: {
          include: { location: true },
        },
      },
    });
  }, {
    timeout: 15000,
  });
};
//////////////////////////////////////////////////////////
// DELETE PRODUCT
//////////////////////////////////////////////////////////

export const deleteProductRepo = async (id: number) => {
  return prisma.product.update({
    where: {
      id,
    },

    data: {
      isVisible: false,
    },
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

  ////////////////////////////////////////////////////////////
  // 🔥 MOVIMIENTOS
  ////////////////////////////////////////////////////////////

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
        : product.purchasePrice;

    //////////////////////////////////////////////////////////
    // 🔥 MOVIMIENTOS PRODUCTO
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

        //////////////////////////////////////////////////////
        // 🔥 FILTRANDO POR SUCURSAL
        //////////////////////////////////////////////////////

        if (locationId) {
          //////////////////////////////////////////////////
          // 🔥 ENTRADA
          //////////////////////////////////////////////////

          if (mov.toLocationId === locationId) {
            entrada = mov.quantity;

            detalle = (
              `TRANSFERENCIA ENTRADA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase();
          }

          //////////////////////////////////////////////////
          // 🔥 SALIDA
          //////////////////////////////////////////////////

          if (mov.fromLocationId === locationId) {
            salida = mov.quantity;

            detalle = (
              `TRANSFERENCIA SALIDA ${transferCode} ` +
              `${fromName} → ${toName}`
            ).toUpperCase();
          }
        } else {
          //////////////////////////////////////////////////
          // 🔥 GLOBAL
          //////////////////////////////////////////////////

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

      ////////////////////////////////////////////////////////
      // 🔥 AGREGAR MOVIMIENTO
      ////////////////////////////////////////////////////////

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
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
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

    //////////////////////////////////////////////////////////
    // 🔥 KARDEX
    //////////////////////////////////////////////////////////

    let saldoCantidad = 0;

    let saldoTotal = 0;

    let costoPromedio = 0;

    const kardexProducto: any[] = [];

    for (const mov of movimientosProducto) {
      ////////////////////////////////////////////////////////
      // 🔥 COSTO REAL DEL MOVIMIENTO
      ////////////////////////////////////////////////////////

      let costoMovimiento = Number(mov.costoUnitario || 0);

      ////////////////////////////////////////////////////////
      // 🔥 SI ENTRA CON COSTO 0
      // USAR COSTO PROMEDIO ACTUAL
      ////////////////////////////////////////////////////////

      if (mov.entrada > 0 && costoMovimiento <= 0) {
        costoMovimiento = costoPromedio;
      }

      ////////////////////////////////////////////////////////
      // 🔥 TOTAL ENTRADA
      ////////////////////////////////////////////////////////

      const entradaTotal = mov.entrada * costoMovimiento;

      ////////////////////////////////////////////////////////
      // 🔥 ENTRADAS
      ////////////////////////////////////////////////////////

      if (mov.entrada > 0) {
        saldoTotal += entradaTotal;

        saldoCantidad += mov.entrada;

        costoPromedio =
          saldoCantidad > 0 ? saldoTotal / saldoCantidad : costoMovimiento;
      }

      ////////////////////////////////////////////////////////
      // 🔥 SALIDAS
      ////////////////////////////////////////////////////////

      let salidaTotal = 0;

      if (mov.salida > 0) {
        salidaTotal = mov.salida * costoPromedio;

        saldoCantidad -= mov.salida;

        saldoTotal -= salidaTotal;
      }

      ////////////////////////////////////////////////////////
      // 🔥 REGISTRO KARDEX
      ////////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////////
    // 🔥 RESULTADO PRODUCTO
    //////////////////////////////////////////////////////////

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

export const getKardexRepository = async (body: any) => {
  ////////////////////////////////////////////////////////////
  // 🔥 ROUND
  ////////////////////////////////////////////////////////////

  const round = (value: number) =>
    Number(Number(value || 0).toFixed(2));

  ////////////////////////////////////////////////////////////
  // 🔥 BODY
  ////////////////////////////////////////////////////////////

  const {
    fromDate,
    toDate,
    sucursal,
    linea,
    marca,
  } = body;

  ////////////////////////////////////////////////////////////
  // 🔥 FECHAS
  ////////////////////////////////////////////////////////////

  const from = new Date(`${fromDate}T00:00:00`);

  const to = new Date(`${toDate}T23:59:59`);

  ////////////////////////////////////////////////////////////
  // 🔥 VENTAS
  ////////////////////////////////////////////////////////////

  const sales = await prisma.saleDetail.findMany({
    where: {
      sale: {
        status: "COMPLETED",

        date: {
          gte: from,
          lte: to,
        },

        ...(sucursal &&
          sucursal !== "" && {
            locationId: Number(sucursal),
          }),
      },

      product: {
        ...(linea &&
          linea !== "" && {
            lineId: Number(linea),
          }),

        ...(marca &&
          marca.trim() !== "" && {
            brandName: {
              contains: marca,
              mode: "insensitive",
            },
          }),
      },
    },

    include: {
      sale: {
        include: {
          employee: true,
          location: true,
        },
      },

      product: {
        include: {
          line: true,
        },
      },

      productUnit: {
        include: {
          unit: true,
        },
      },
    },

    orderBy: {
      saleId: "asc",
    },
  });

  ////////////////////////////////////////////////////////////
  // 🔥 RESULT
  ////////////////////////////////////////////////////////////

  const result: any[] = [];

  ////////////////////////////////////////////////////////////
  // 🔥 RECORRER ITEMS
  ////////////////////////////////////////////////////////////

  sales.forEach((item: any) => {
    //////////////////////////////////////////////////////////
    // 🔥 INFO
    //////////////////////////////////////////////////////////

    const seller =
      `${item.sale.employee.name} ${item.sale.employee.lastName}`;

    const branch =
      item.sale.location.name;

    const line =
      item.product.line?.name ||
      "Sin línea";

    const brand =
      item.product.brandName ||
      "Sin marca";

    //////////////////////////////////////////////////////////
    // 🔥 PRECIO BASE
    //////////////////////////////////////////////////////////

    const price = round(
      Number(item.product.salePrice || 0)
    );

    //////////////////////////////////////////////////////////
    // 🔥 SUBTOTAL
    //////////////////////////////////////////////////////////

    const subtotal = round(
      Number(item.quantity) *
        Number(item.unitPrice)
    );

    //////////////////////////////////////////////////////////
    // 🔥 PRECIO HISTÓRICO
    //////////////////////////////////////////////////////////

    const finalPrice = round(
      subtotal /
        Number(item.quantity || 1)
    );

    //////////////////////////////////////////////////////////
    // 🔥 DESCUENTO REAL DEL ITEM
    //////////////////////////////////////////////////////////

    const discount = round(
      Number(item.itemDiscount || 0)
    );

    //////////////////////////////////////////////////////////
    // 🔥 TOTAL
    //////////////////////////////////////////////////////////

    const total = round(
      subtotal - discount
    );

    //////////////////////////////////////////////////////////
    // 🔥 PUSH
    //////////////////////////////////////////////////////////

    result.push({
      id: item.id,

      ////////////////////////////////////////////////////////
      // 🔥 VENTA
      ////////////////////////////////////////////////////////

      saleId: item.sale.id,

      date: item.sale.date,

      status: item.sale.status,

      ////////////////////////////////////////////////////////
      // 🔥 PRODUCTO
      ////////////////////////////////////////////////////////

      productId: item.product.id,

      product: item.product.name,

      name: item.product.name,

      barcode: item.product.code,

      line,

      brand,

      ////////////////////////////////////////////////////////
      // 🔥 UBICACIÓN
      ////////////////////////////////////////////////////////

      branch,

      seller,

      ////////////////////////////////////////////////////////
      // 🔥 UNIDAD
      ////////////////////////////////////////////////////////

      unitName: item.unitName,

      equivalence: Number(
        item.equivalence || 1
      ),

      ////////////////////////////////////////////////////////
      // 🔥 TOTALES
      ////////////////////////////////////////////////////////

      quantity: Number(item.quantity),

      ////////////////////////////////////////////////////////
      // 🔥 PRECIOS
      ////////////////////////////////////////////////////////

      price,

      unitPrice: round(
        Number(item.unitPrice)
      ),

      finalPrice,

      ////////////////////////////////////////////////////////
      // 🔥 MONTOS
      ////////////////////////////////////////////////////////

      subtotal,

      discount,

      total,
    });
  });

  ////////////////////////////////////////////////////////////
  // 🔥 TOTALES GENERALES
  ////////////////////////////////////////////////////////////

  const subtotal = round(
    result.reduce(
      (acc, item) =>
        acc +
        Number(item.subtotal || 0),
      0
    )
  );

  const discount = round(
    result.reduce(
      (acc, item) =>
        acc +
        Number(item.discount || 0),
      0
    )
  );

  const total = round(
    result.reduce(
      (acc, item) =>
        acc + Number(item.total || 0),
      0
    )
  );

  ////////////////////////////////////////////////////////////
  // 🔥 LOGS
  ////////////////////////////////////////////////////////////

  console.log("💰 SUBTOTAL:", subtotal);

  console.log("🏷️ DISCOUNT:", discount);

  console.log("✅ TOTAL:", total);

  ////////////////////////////////////////////////////////////
  // 🔥 AGRUPAR PRODUCTOS
  ////////////////////////////////////////////////////////////

  const groupedProducts: any = {};

  result.forEach((item) => {
    //////////////////////////////////////////////////////////
    // 🔥 KEY
    //////////////////////////////////////////////////////////

    const key = item.barcode;

    //////////////////////////////////////////////////////////
    // 🔥 INIT
    //////////////////////////////////////////////////////////

    if (!groupedProducts[key]) {
      groupedProducts[key] = {
        id: item.id,

        name: item.name,

        product: item.product,

        seller: item.seller,

        branch: item.branch,

        line: item.line,

        brand: item.brand,

        barcode: item.barcode,

        sellers: [],

        quantity: 0,

        subtotal: 0,

        discount: 0,

        total: 0,

        price: item.price,

        details: [],
      };
    }

    //////////////////////////////////////////////////////////
    // 🔥 ACUMULAR GENERALES
    //////////////////////////////////////////////////////////

    groupedProducts[key].quantity +=
      Number(item.quantity || 0);

    groupedProducts[key].subtotal =
      round(
        groupedProducts[key].subtotal +
          Number(item.subtotal || 0)
      );

    groupedProducts[key].discount =
      round(
        groupedProducts[key].discount +
          Number(item.discount || 0)
      );

    groupedProducts[key].total = round(
      groupedProducts[key].total +
        Number(item.total || 0)
    );

    //////////////////////////////////////////////////////////
    // 🔥 SELLERS
    //////////////////////////////////////////////////////////

    const existingSeller =
      groupedProducts[key].sellers.find(
        (seller: any) =>
          seller.name === item.seller
      );

    if (existingSeller) {
      existingSeller.quantity +=
        Number(item.quantity || 0);

      existingSeller.subtotal = round(
        existingSeller.subtotal +
          Number(item.subtotal || 0)
      );

      existingSeller.discount = round(
        existingSeller.discount +
          Number(item.discount || 0)
      );

      existingSeller.total = round(
        existingSeller.total +
          Number(item.total || 0)
      );
    } else {
      groupedProducts[key].sellers.push({
        name: item.seller,

        quantity: Number(
          item.quantity || 0
        ),

        subtotal: Number(
          item.subtotal || 0
        ),

        discount: Number(
          item.discount || 0
        ),

        total: Number(item.total || 0),
      });
    }

    //////////////////////////////////////////////////////////
    // 🔥 BUSCAR DETALLE
    //////////////////////////////////////////////////////////

    const existingDetail =
      groupedProducts[key].details.find(
        (detail: any) =>
          Number(detail.finalPrice) ===
            Number(item.finalPrice) &&
          detail.unitName === item.unitName
      );

    //////////////////////////////////////////////////////////
    // 🔥 SI EXISTE
    //////////////////////////////////////////////////////////

    if (existingDetail) {
      existingDetail.quantity +=
        Number(item.quantity || 0);

      existingDetail.subtotal = round(
        existingDetail.subtotal +
          Number(item.subtotal || 0)
      );

      existingDetail.discount = round(
        existingDetail.discount +
          Number(item.discount || 0)
      );

      existingDetail.total = round(
        existingDetail.total +
          Number(item.total || 0)
      );
    }

    //////////////////////////////////////////////////////////
    // 🔥 NUEVO DETALLE
    //////////////////////////////////////////////////////////

    else {
      groupedProducts[key].details.push({
        unitName: item.unitName,

        finalPrice: item.finalPrice,

        quantity: Number(
          item.quantity || 0
        ),

        subtotal: Number(
          item.subtotal || 0
        ),

        discount: Number(
          item.discount || 0
        ),

        total: Number(item.total || 0),
      });
    }
  });

  ////////////////////////////////////////////////////////////
  // 🔥 FORMATEAR
  ////////////////////////////////////////////////////////////

  const finalResult = Object.values(
    groupedProducts
  ).map((item: any) => ({
    ...item,

    //////////////////////////////////////////////////////////
    // 🔥 PRECIOS
    //////////////////////////////////////////////////////////

    finalPrice: item.details
      .map(
        (detail: any) =>
          `${detail.unitName}: Bs ${Number(
            detail.finalPrice
          ).toFixed(2)}`
      )
      .join(" / "),

    //////////////////////////////////////////////////////////
    // 🔥 CANTIDADES
    //////////////////////////////////////////////////////////

    quantityDetail: item.details
      .map(
        (detail: any) =>
          `${detail.quantity}`
      )
      .join(" / "),

    //////////////////////////////////////////////////////////
    // 🔥 SUBTOTALES
    //////////////////////////////////////////////////////////

    subtotalDetail: item.details
      .map(
        (detail: any) =>
          `Bs ${Number(
            detail.subtotal
          ).toFixed(2)}`
      )
      .join(" / "),

    //////////////////////////////////////////////////////////
    // 🔥 DESCUENTOS
    //////////////////////////////////////////////////////////

    discountDetail: item.details
      .map(
        (detail: any) =>
          `Bs ${Number(
            detail.discount
          ).toFixed(2)}`
      )
      .join(" / "),

    //////////////////////////////////////////////////////////
    // 🔥 TOTALES
    //////////////////////////////////////////////////////////

    totalDetail: item.details
      .map(
        (detail: any) =>
          `Bs ${Number(
            detail.total
          ).toFixed(2)}`
      )
      .join(" / "),
  }));

  ////////////////////////////////////////////////////////////
  // 🔥 RETURN
  ////////////////////////////////////////////////////////////

  return finalResult;
};