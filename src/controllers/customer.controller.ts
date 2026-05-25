import { Request, Response } from 'express'
import {
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  addCustomerAddress,
  removeCustomerAddress,
  createNote,
  deleteNote,
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

export const editCustomer = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { name, nitCi, businessName, code, phone, whatsapp, occupation, originChannel } = req.body

    const customer = await updateCustomer(id, { name, nitCi, businessName, code, phone, whatsapp, occupation, originChannel })
    return res.status(200).json(customer)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'NIT/CI o código ya registrado' })
    }
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

// ── Direcciones ──────────────────────────────────────────────

export const storeAddress = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.id)
    const { address, label, latitude, longitude, reference, isPrimary } = req.body

    if (!address) {
      return res.status(400).json({ message: 'La dirección es requerida' })
    }

    const result = await addCustomerAddress(customerId, { address, label, latitude, longitude, reference, isPrimary })
    return res.status(201).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Error al agregar dirección', error })
  }
}

export const removeAddress = async (req: Request, res: Response) => {
  try {
    const addressId = Number(req.params.addressId)
    await removeCustomerAddress(addressId)
    return res.status(200).json({ message: 'Dirección eliminada' })
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar dirección', error })
  }
}

// ── Notas ────────────────────────────────────────────────────

export const storeNote = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.id)
    const { content } = req.body

    if (!content) {
      return res.status(400).json({ message: 'El contenido es requerido' })
    }

    const note = await createNote(customerId, content)
    return res.status(201).json(note)
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear nota', error })
  }
}

export const removeNote = async (req: Request, res: Response) => {
  try {
    const noteId = Number(req.params.noteId)
    await deleteNote(noteId)
    return res.status(200).json({ message: 'Nota eliminada' })
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar nota', error })
  }
}

