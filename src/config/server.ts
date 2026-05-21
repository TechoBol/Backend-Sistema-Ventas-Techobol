import express, { urlencoded } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import compression from 'compression'
import authenticationRoute from '../routes/authentication.routes'
import productRoute from '../routes/product.routes'
import lineRoute from '../routes/line.routes'
import saleRoute from '../routes/sale.routes'
import customerRoute from '../routes/customer.routes'
import locationRoute from '../routes/location.routes'
import employeeRoute from '../routes/employee.routes'
import roleRoute from '../routes/role.routes'
import transferRoute from '../routes/transferencias.routes'
import dashboardRoutes from "../routes/dashboard.routes";

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
app.use('/api/customer',verifyToken, customerRoute)
app.use('/api/location',verifyToken, locationRoute)
app.use('/api/employee',verifyToken, employeeRoute)
app.use('/api/role',verifyToken, roleRoute)
app.use('/api/transfer',verifyToken, transferRoute)
app.use('/api/dashboard', verifyToken, dashboardRoutes)

export default app
