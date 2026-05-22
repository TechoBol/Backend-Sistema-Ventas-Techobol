import prisma from '../config/db'

export const getCustomers = async () => {
 return await prisma.customer.findMany({
  where: {
    isVisible: true,
  },

  include: {
    addresses: {
      where: {
        isVisible: true,
      },

      orderBy: {
        isPrimary: "desc",
      },
    },
  },

  orderBy: {
    id: "asc",
  },
});
}

export const getCustomerById = async (id: number) => {
  return await prisma.customer.findFirst({
    where: {
      id,
      isVisible: true,
    },
  })
}

export const createCustomer = async (data: {
  name: string
  nitCi?: string
  businessName?: string
  phone?: string
  address?: string
  latitude?: number
  longitude?: number
}) => {
  return await prisma.customer.create({
    data,
  })
}

export const updateCustomer = async (
  id: number,
  data: {
    name?: string
    nitCi?: string
    businessName?: string
    phone?: string
    address?: string
    latitude?: number
    longitude?: number
  }
) => {
  return await prisma.customer.update({
    where: { id },
    data,
  })
}

export const deleteCustomer = async (id: number) => {
  return await prisma.customer.update({
    where: { id },
    data: {
      isVisible: false,
    },
  })
}
