import io from 'socket.io'

const employeeSocketInstance = (io: io.Server) => {
  io.on('connection', socket => {
    socket.on('createEmployee', (employee) => {
      socket.broadcast.emit('employeeUpdated', employee)
    })
    socket.on('deleteEmployee', (employeeId) => {
      socket.broadcast.emit('employeeRemoved', employeeId)
    })

  })
}

export default employeeSocketInstance