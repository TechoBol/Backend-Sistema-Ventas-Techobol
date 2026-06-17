import app from './config/server'
import { config } from 'dotenv'

import http from 'http'
import { Server as SocketServer } from 'socket.io'
import intentorySocketInstance from './sockets/inventory.sockets'
import locationSocketInstance from './sockets/sucursal.sockets'
import employeeSocketInstance from './sockets/trbajador.sockets'
import rolSocketInstance from './sockets/roles.sockets'
import { initNotificationSocket } from './sockets/notification.sockets'
import { seedGenericCustomer } from './utils/genericCustomer'
import { startExpireQuotationsJob } from "./utils/expireQuotations.job ";

config()

const port = process.env.PORT
startExpireQuotationsJob();

const server = http.createServer(app)
const io = new SocketServer(server, {
  cors: {
    origin: `*`
  }
})
intentorySocketInstance(io)
locationSocketInstance(io)
employeeSocketInstance(io)
rolSocketInstance(io)
initNotificationSocket(io)

io.on('connection', socket => {
  console.log('a user connected ' + socket.id)
})
app.set("io", io);
const host = '0.0.0.0'

server.listen({ port, host }, async () => {
  await seedGenericCustomer()              
  console.log(`Server running on port ${port}`)
})