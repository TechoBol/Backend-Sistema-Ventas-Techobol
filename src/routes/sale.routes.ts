import { Router } from 'express'
import { createSale, getSales, updateSaleDate, updateSalePaymentMethod  } from '../controllers/sale.controller'

const router = Router()

router.post('/create-sale', createSale)
router.get("/get-sales", getSales);
router.put("/:id", updateSalePaymentMethod);
router.put("/date/:id", updateSaleDate);

export default router