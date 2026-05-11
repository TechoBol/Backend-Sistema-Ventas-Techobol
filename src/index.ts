import app from './config/server'
import { config } from 'dotenv'

import http from 'http'
import { Server as SocketServer } from 'socket.io'
import intentorySocketInstance from './sockets/inventory.sockets'
import locationSocketInstance from './sockets/sucursal.sockets'
import employeeSocketInstance from './sockets/trbajador.sockets'
import rolSocketInstance from './sockets/roles.sockets'

config()

const port = process.env.PORT

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

io.on('connection', socket => {
  console.log('a user connected ' + socket.id)
})

const host = '0.0.0.0'

server.listen({ port, host }, () => {
  console.log(`Server running on port ${port}`)
})