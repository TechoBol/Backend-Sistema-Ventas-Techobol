import express, { urlencoded } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import compression from 'compression'
import authenticationRoute from '../routes/authentication.routes'

//import { verifyToken } from '../middleware/auth.middleware'

const app = express()

app.use(morgan('dev'))
app.use(cors())
app.use(compression())
app.use(express.json())
app.use(urlencoded({ extended: true }))

app.use('/api/authentication', authenticationRoute)

export default app
