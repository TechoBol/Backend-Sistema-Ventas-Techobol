import io from 'socket.io'

const accountSocketInstance = (io: io.Server) => {
  io.on('connection', socket => {
    socket.on('createAccount', newAccount => {
      socket.broadcast.emit('newAccount', newAccount)
    })

    socket.on('deleteAccount', deletedAccount => {
      socket.broadcast.emit('deletedAccount', deletedAccount)
    })

  })
}


export default accountSocketInstance