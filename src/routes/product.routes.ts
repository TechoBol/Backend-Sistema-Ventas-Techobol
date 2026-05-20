import { Router } from 'express'
import { createProduct , getProducts, updateProduct } from '../controllers/product.controller'

const router = Router()

router.post('/create-product', createProduct)
router.get('/get-products', getProducts)
router.put('/update-product/:id', updateProduct)


export default router