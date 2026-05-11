import { Router } from 'express'
import { signIn, validateToken } from '../controllers/authentication.controller'
//import { changePassword } from '../controllers/employee.controller'

const route = Router()

route.post('/signIn', signIn)
route.post('/validateToken', validateToken)
//route.put('/change-password/:token', changePassword)

export default route
