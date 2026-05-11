import io from 'socket.io'

const rolSocketInstance = (io: io.Server) => {
  io.on('connection', socket => {
    socket.on('createRole', (role) => {
      socket.broadcast.emit('roleUpdated', role)
    })
    socket.on('deleteRole', (roleId) => {
      socket.broadcast.emit('roleRemoved', roleId)
    })

  })
}

export default rolSocketInstance