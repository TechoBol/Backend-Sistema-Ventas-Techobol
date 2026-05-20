import { Request, Response } from 'express'
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../repository/customer.repository'

export const listCustomers = async (_req: Request, res: Response) => {
  try {
    const customers = await getCustomers()
    return res.status(200).json(customers)
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener clientes', error })
  }
}

export const findCustomerById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const customer = await getCustomerById(id)

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' })
    }

    return res.status(200).json(customer)
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener cliente', error })
  }
}

export const storeCustomer = async (req: Request, res: Response) => {
  try {
    const customer = await createCustomer(req.body)
    return res.status(201).json(customer)
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear cliente', error })
  }
}

export const editCustomer = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const customer = await updateCustomer(id, req.body)

    return res.status(200).json(customer)
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar cliente', error })
  }
}

export const removeCustomer = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    await deleteCustomer(id)

    return res.status(200).json({ message: 'Cliente eliminado correctamente' })
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar cliente', error })
  }
}
