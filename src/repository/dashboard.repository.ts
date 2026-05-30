import prisma from '../config/db'

const HORA_INICIO = 8;
const HORA_FIN = 18;

export const getDashboardSummary = async () => {
  const today = new Date();

  const startDay = new Date(today);
  startDay.setHours(0, 0, 0, 0);

  const endDay = new Date(today);
  endDay.setHours(23, 59, 59, 999);

  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  // =====================================================
  // KPIs
  // =====================================================

  const [
    ventasHoy,
    ventasHistoricas,
    transaccionesHistoricas,
    transaccionesHoy,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: "COMPLETED", date: { gte: startDay, lte: endDay } },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { status: "COMPLETED", date: { gte: startMonth, lte: endMonth } },
      _sum: { total: true },
    }),
    prisma.sale.count({
      where: { status: "COMPLETED", date: { gte: startMonth, lte: endMonth } },
    }),
    prisma.sale.count({
      where: { status: "COMPLETED", date: { gte: startDay, lte: endDay } },
    }),
  ]);

  // =====================================================
  // VENTAS ÚLTIMOS 5 DÍAS — paralelizado con Promise.all
  // =====================================================

  const ultimos5Dias = await Promise.all(
    (() => {
      const diasConfig: { start: Date; end: Date; label: string }[] = [];
      let offset = 1;

      while (diasConfig.length < 5) {
        const start = new Date();
        start.setDate(start.getDate() - offset);
        start.setHours(0, 0, 0, 0);

        if (start.getDay() !== 0) {
          const end = new Date(start);
          end.setHours(23, 59, 59, 999);
          const label = start.toLocaleDateString("es-BO", { weekday: "short" });
          diasConfig.push({ start, end, label });
        }

        offset++;
      }

      // 👇 Invertir para que queden del más antiguo al más reciente
      diasConfig.reverse();

      // Agregar hoy al final
      diasConfig.push({ start: startDay, end: endDay, label: "Hoy" });

      return diasConfig.map(({ start, end, label }) =>
        prisma.sale
          .aggregate({
            where: { status: "COMPLETED", date: { gte: start, lte: end } },
            _sum: { total: true },
          })
          .then((r) => ({ dia: label, total: r._sum.total || 0 }))
      );
    })()
  );

  // =====================================================
  // TIPO DE PAGO
  // =====================================================

  const pagos = await prisma.sale.groupBy({
    by: ["typeSale"],
    where: { status: "COMPLETED" },
    _sum: { total: true },
  });

  const tipo_pago = pagos.map((p) => ({
    tipo: p.typeSale || "Sin tipo",
    total: p._sum.total || 0,
  }));

  // =====================================================
  // HORA PICO
  // =====================================================

  const ventasHoyDetalle = await prisma.sale.findMany({
    where: { status: "COMPLETED", date: { gte: startDay, lte: endDay } },
    select: { date: true },
  });

  const horasMap: Record<number, number> = {};
  for (let h = HORA_INICIO; h < HORA_FIN; h++) horasMap[h] = 0;

  ventasHoyDetalle.forEach((sale) => {
    const hour = new Date(sale.date).getHours();
    if (hour >= HORA_INICIO && hour < HORA_FIN) {
      horasMap[hour]++;
    }
  });

  const hora_pico = Object.entries(horasMap)
    .map(([hora, ventas]) => ({ hora: `${hora}h`, ventas }))
    .filter((h) => h.ventas > 0);

  // =====================================================
  // PRODUCTOS MÁS VENDIDOS — findMany en lugar de N queries
  // =====================================================

  const productosGroup = await prisma.saleDetail.groupBy({
    by: ["productId"],
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

  // =====================================================
  // SUCURSALES TOP — findMany en lugar de N queries
  // =====================================================

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

  const sucursales_top = sucursalesGroup.map((s) => ({
    nombre: locationsMap[s.locationId] || "Sucursal",
    total: s._sum.total || 0,
  }));

  // =====================================================
  // CLIENTES TOP — findMany en lugar de N queries
  // =====================================================

  const clientesGroup = await prisma.sale.groupBy({
    by: ["customerId"],
    where: { status: "COMPLETED", customerId: { not: null } },
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

  // =====================================================
  // RESPONSE
  // =====================================================

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
  };
};