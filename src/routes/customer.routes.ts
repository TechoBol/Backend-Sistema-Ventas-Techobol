import { Router } from 'express'
import {
  listCustomers,
  findCustomerById,
  storeCustomer,
  editCustomer,
  removeCustomer,
} from '../controllers/customer.controller'

const router = Router()

router.get('/', listCustomers)
router.get('/:id', findCustomerById)
router.post('/', storeCustomer)
router.put('/:id', editCustomer)
router.delete('/:id', removeCustomer)

export default router
