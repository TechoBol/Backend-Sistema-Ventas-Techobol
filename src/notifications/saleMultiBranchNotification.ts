import prisma from "../config/db";
import { sendMultiBranchSale } from "../utils/sendMultiBranchSale";

export const notifyMultiBranchSale = async (saleId: number) => {
  // Obtener toda la información necesaria
  const sale = await prisma.sale.findUnique({
    where: {
      id: saleId,
    },
    include: {
      customer: true,

      employee: true,

      location: true,

      details: {
        include: {
          product: true,
          outputLocation: {
            include: {
              employees: {
                where: {
                  isVisible: true,
                  email: {
                    not: null,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!sale) return;

  /**
   * Agrupar productos por sucursal de salida
   */
  const groupedLocations = new Map<
    number,
    {
      branch: string;
      employees: {
        email: string;
      }[];
      products: {
        code: string;
        name: string;
        unidad: string;
        quantity: number;
      }[];
    }
  >();

  for (const detail of sale.details) {
    if (
      !detail.outputLocationId ||
      detail.outputLocationId === sale.locationId
    ) {
      continue;
    }

    if (!groupedLocations.has(detail.outputLocationId)) {
      groupedLocations.set(detail.outputLocationId, {
        branch: detail.outputLocation?.name ?? "",
        employees:
          detail.outputLocation?.employees
            .filter((e) => e.email)
            .map((e) => ({
              email: e.email!,
            })) ?? [],
        products: [],
      });
    }

    groupedLocations.get(detail.outputLocationId)!.products.push({
      code: detail.product.code,
      name: detail.product.name,
      unidad: detail.unitName,
      quantity: detail.quantity,
    });
  }

  /**
   * Enviar correo por cada sucursal involucrada
   */
  for (const [, group] of groupedLocations) {
    for (const employee of group.employees) {
      try {
        await sendMultiBranchSale({
          email: employee.email,
          branch: sale.location.name,
          saleCode: sale.code!,
          customer: sale.customer?.name ?? "Cliente",
          products: group.products,
        });
      } catch (error) {
        console.error(`Error enviando correo a ${employee.email}`, error);
      }
    }
  }
};
