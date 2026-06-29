import prisma from '../config/db'

const HORA_INICIO = 8;
const HORA_FIN = 18;

// Si locationId es undefined, no filtra (ve todo)
export const getDashboardSummary = async (locationId?: number) => {
  const today = new Date();
  const startDay = new Date(today); startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(today); endDay.setHours(23, 59, 59, 999);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  // Filtro reutilizable — si no hay locationId, el filtro está vacío
  const locationFilter = locationId ? { locationId } : {};

  const [ventasHoy, ventasHistoricas, transaccionesHistoricas, transaccionesHoy] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { status: "COMPLETED", date: { gte: startDay, lte: endDay }, ...locationFilter },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { status: "COMPLETED", date: { gte: startMonth, lte: endMonth }, ...locationFilter },
        _sum: { total: true },
      }),
      prisma.sale.count({
        where: { status: "COMPLETED", date: { gte: startMonth, lte: endMonth }, ...locationFilter },
      }),
      prisma.sale.count({
        where: { status: "COMPLETED", date: { gte: startDay, lte: endDay }, ...locationFilter },
      }),
    ]);

  // Ventas últimos 5 días
  const ultimos5Dias = await Promise.all(
    (() => {
      const diasConfig: { start: Date; end: Date; label: string }[] = [];
      let offset = 1;
      while (diasConfig.length < 5) {
        const start = new Date();
        start.setDate(start.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        if (start.getDay() !== 0) {
          const end = new Date(start); end.setHours(23, 59, 59, 999);
          diasConfig.push({ start, end, label: start.toLocaleDateString("es-BO", { weekday: "short" }) });
        }
        offset++;
      }
      diasConfig.reverse();
      diasConfig.push({ start: startDay, end: endDay, label: "Hoy" });
      return diasConfig.map(({ start, end, label }) =>
        prisma.sale.aggregate({
          where: { status: "COMPLETED", date: { gte: start, lte: end }, ...locationFilter },
          _sum: { total: true },
        }).then((r) => ({ dia: label, total: r._sum.total || 0 }))
      );
    })()
  );

  // Tipo de pago
  const pagos = await prisma.sale.groupBy({
    by: ["typeSale"],
    where: { status: "COMPLETED", ...locationFilter },
    _sum: { total: true },
  });
  const tipo_pago = pagos.map((p) => ({ tipo: p.typeSale || "Sin tipo", total: p._sum.total || 0 }));

  // Hora pico
  const ventasHoyDetalle = await prisma.sale.findMany({
    where: { status: "COMPLETED", date: { gte: startDay, lte: endDay }, ...locationFilter },
    select: { date: true },
  });
  const horasMap: Record<number, number> = {};
  for (let h = HORA_INICIO; h < HORA_FIN; h++) horasMap[h] = 0;
  ventasHoyDetalle.forEach((sale) => {
    const hour = new Date(sale.date).getHours();
    if (hour >= HORA_INICIO && hour < HORA_FIN) horasMap[hour]++;
  });
  const hora_pico = Object.entries(horasMap)
    .map(([hora, ventas]) => ({ hora: `${hora}h`, ventas }))
    .filter((h) => h.ventas > 0);

  // Productos top
  const productosGroup = await prisma.saleDetail.groupBy({
    by: ["productId"],
    // SaleDetail no tiene locationId directo, se filtra por las ventas de esa sucursal
    where: locationId
      ? { sale: { status: "COMPLETED", locationId } }
      : { sale: { status: "COMPLETED" } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });
  const productIds = productosGroup.map((p) => p.productId);
  const productosData = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const productosMap = Object.fromEntries(productosData.map((p) => [p.id, p.name]));
  const productos_top = productosGroup.map((p) => ({
    nombre: productosMap[p.productId] || "Producto",
    cantidad: p._sum.quantity || 0,
  }));

  // Sucursales top — solo tiene sentido si es vista global (sin filtro de sucursal)
  const sucursales_top = !locationId ? await (async () => {
    const sucursalesGroup = await prisma.sale.groupBy({
      by: ["locationId"],
      where: { status: "COMPLETED" },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    });
    const locationIds = sucursalesGroup.map((s) => s.locationId);
    const locationsData = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const locationsMap = Object.fromEntries(locationsData.map((l) => [l.id, l.name]));
    return sucursalesGroup.map((s) => ({ nombre: locationsMap[s.locationId] || "Sucursal", total: s._sum.total || 0 }));
  })() : [];

  // Clientes top
  const clientesGroup = await prisma.sale.groupBy({
    by: ["customerId"],
    where: { status: "COMPLETED", customerId: { not: null }, ...locationFilter },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 5,
  });
  const customerIds = clientesGroup.map((c) => c.customerId!);
  const customersData = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const customersMap = Object.fromEntries(customersData.map((c) => [c.id, c.name]));
  const clientes_top = clientesGroup.map((c) => ({
    nombre: customersMap[c.customerId!] || "Cliente",
    total: c._sum.total || 0,
  }));

  //Mejores vendedores por sucursal y general
  const vendedoresGroup = await prisma.sale.groupBy({
    by: ["employeeId"],
    where: { status: "COMPLETED", date: { gte: startMonth, lte: endMonth }, ...locationFilter },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: locationId ? 1 : 5,
  });
  const employeeIds = vendedoresGroup.map((v) => v.employeeId);
  const employeesData = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true, lastName: true },
  });
  const employeesMap = Object.fromEntries(employeesData.map((e) => [e.id, `${e.name} ${e.lastName}`]));
  const vendedores_top = vendedoresGroup.map((v) => ({
    nombre: employeesMap[v.employeeId] || "Empleado",
    transacciones: v._count.id,
  }));

  //productos sin movimiento por mas de 30 dias
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const productosConMovimiento = await prisma.saleDetail.findMany({
    where: {
      sale: { status: "COMPLETED", date: { gte: hace30Dias }, ...locationFilter },
    },
    select: { productId: true },
    distinct: ["productId"],
  });
  const idsConMovimiento = productosConMovimiento.map((p) => p.productId);

  const sin_movimiento = await prisma.product.findMany({
    where: {
      id: { notIn: idsConMovimiento },
      isVisible: true,
      ...(locationId ? { inventories: { some: { locationId, quantity: { gt: 0 } } } } : {}),
    },
    select: { id: true, name: true },
    take: 10,
  });

  //Grafico de estado de cotizaciones
  const cotizacionesEstados = await prisma.quotation.groupBy({
    by: ["status"],
    where: { ...(locationId ? { locationId } : {}) },
    _count: { id: true },
  });
  const estadosMap = Object.fromEntries(
    cotizacionesEstados.map((c) => [c.status, c._count.id])
  );
  const cotizaciones_estados = {
    pendientes: estadosMap["PENDING"] ?? 0,
    aprobadas: estadosMap["APPROVED"] ?? 0,
    rechazadas: estadosMap["REJECTED"] ?? 0,
    vencidas: estadosMap["EXPIRED"] ?? 0,
  };

  return {
    kpis: {
      venta_dia: ventasHoy._sum.total || 0,
      transacciones_hoy: transaccionesHoy,
      monto_historico: ventasHistoricas._sum.total || 0,
      transacciones_historicas: transaccionesHistoricas,
      fecha_hoy: today.toISOString(),
    },
    ventas_semana: ultimos5Dias,
    tipo_pago,
    hora_pico,
    productos_top,
    sucursales_top,
    clientes_top,
    vendedores_top,
    sin_movimiento,
    cotizaciones_estados,
  };
};