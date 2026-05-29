import prisma from "../config/db";

export type CustomerUpdateInput = {
  name?: string;
  nitCi?: string;
  businessName?: string;
  code?: string;
  phone?: string;
  whatsapp?: string;
  occupation?: string;
  originChannel?: string;
};

export const getCustomers = async () => {
  return await prisma.customer.findMany({
    where: { isVisible: true },
    include: {
      addresses: {
        where: { isVisible: true },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: { id: "asc" },
  });
};

export const getCustomerById = async (id: number) => {
  const customer = await prisma.customer.findFirst({
    where: { id, isVisible: true },
    include: {
      addresses: {
        where: { isVisible: true },
        orderBy: { isPrimary: "desc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      notes: {
        orderBy: { createdAt: "desc" },
      },
      sales: {
        where: { status: "COMPLETED" },
        orderBy: { date: "asc" },
        include: {
          customer: {
            select: {
              nitCi: true,
            },
          },
          employee: { select: { name: true, lastName: true } },
          location: { select: { name: true } },
        },
      },
    },
  });

  if (!customer) return null;

  const favoritePaymentMethod = getFavoritePaymentMethod(customer.sales);
  const purchaseFrequencyDays = getPurchaseFrequencyDays(customer.sales);
  const pendingActivities = getPendingActivities({
    reserveAmount: customer.reserveAmount,
    sales: customer.sales,
    purchaseFrequencyDays,
  });

  return {
    ...customer,
    favoritePaymentMethod,
    purchaseFrequencyDays,
    pendingActivities,
  };
};

export const updateCustomer = async (id: number, data: CustomerUpdateInput) => {
  return await prisma.customer.update({
    where: { id },
    data,
  });
};

export const deleteCustomer = async (id: number) => {
  return await prisma.customer.update({
    where: { id },
    data: { isVisible: false },
  });
};

// ── Direcciones ─────────────────────────────────────────────

export const addCustomerAddress = async (
  customerId: number,
  data: {
    address: string;
    label?: string;
    latitude?: number;
    longitude?: number;
    reference?: string;
    isPrimary?: boolean;
  },
) => {
  if (data.isPrimary) {
    await prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isPrimary: false },
    });
  }
  return await prisma.customerAddress.create({
    data: {
      customerId,
      address: data.address,
      label: data.label,
      latitude: data.latitude,
      longitude: data.longitude,
      reference: data.reference,
      isPrimary: data.isPrimary ?? false,
    },
  });
};

export const removeCustomerAddress = async (addressId: number) => {
  return await prisma.customerAddress.update({
    where: { id: addressId },
    data: { isVisible: false },
  });
};

// ── Notas ────────────────────────────────────────────────────

export const createNote = async (customerId: number, content: string) => {
  return await prisma.note.create({
    data: { customerId, content },
  });
};

export const deleteNote = async (noteId: number) => {
  return await prisma.note.delete({
    where: { id: noteId },
  });
};

// ── Helpers calculados ───────────────────────────────────────

function getFavoritePaymentMethod(
  sales: { typeSale: string | null }[],
): string | null {
  const counts: Record<string, number> = {};

  for (const sale of sales) {
    if (!sale.typeSale) continue;
    counts[sale.typeSale] = (counts[sale.typeSale] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function getPurchaseFrequencyDays(sales: { date: Date }[]): number | null {
  if (sales.length < 2) return null;

  let totalDays = 0;
  for (let i = 1; i < sales.length; i++) {
    const diff = sales[i].date.getTime() - sales[i - 1].date.getTime();
    totalDays += diff / (1000 * 60 * 60 * 24);
  }

  return Math.round(totalDays / (sales.length - 1));
}

function getPendingActivities(customer: {
  reserveAmount: number;
  sales: { date: Date }[];
  purchaseFrequencyDays?: number | null;
}): string[] {
  const pending: string[] = [];
  const now = new Date();

  if (customer.reserveAmount > 0) {
    pending.push("Llamar al cliente por reserva pendiente");
  }

  if (customer.sales.length > 0 && customer.purchaseFrequencyDays) {
    const lastSale = customer.sales[customer.sales.length - 1];
    const daysSinceLastSale =
      (now.getTime() - lastSale.date.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastSale > customer.purchaseFrequencyDays * 1.5) {
      pending.push("Cliente sin compra reciente, ofrecer promoción");
    }
  }

  return pending;
}
