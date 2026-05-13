import express, { urlencoded } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import compression from 'compression'
import authenticationRoute from '../routes/authentication.routes'
import productRoute from '../routes/product.routes'
import lineRoute from '../routes/line.routes'
import saleRoute from '../routes/sale.routes'

import { verifyToken } from '../middleware/auth.middleware'

const app = express()

app.use(morgan('dev'))
app.use(cors())
app.use(compression())
app.use(express.json())
app.use(urlencoded({ extended: true }))

app.use('/api/authentication', authenticationRoute)
app.use('/api/product',verifyToken, productRoute)
app.use('/api/line',verifyToken, lineRoute)
app.use('/api/sale',verifyToken, saleRoute)

export default app
