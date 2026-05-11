import io from 'socket.io'

const locationSocketInstance = (io: io.Server) => {
  io.on('connection', socket => {
    socket.on('createLocation', (location) => {
      socket.broadcast.emit('locationUpdated', location)
    })
    socket.on('deleteLocation', (locationId) => {
      socket.broadcast.emit('locationRemoved', locationId)
    })

  })
}

export default locationSocketInstance