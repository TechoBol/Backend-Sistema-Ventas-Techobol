import { Router } from 'express'
import { createProduct , getKardex, getKardexPro, getProducts, updateProduct } from '../controllers/product.controller'

const router = Router()

router.post('/create-product', createProduct)
router.get('/get-products', getProducts)
router.put('/update-product/:id', updateProduct)
router.post('/kardex', getKardex)
router.post('/kardex-pro', getKardexPro)

export default router