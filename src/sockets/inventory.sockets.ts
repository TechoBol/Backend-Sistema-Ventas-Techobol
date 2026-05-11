import io from "socket.io";

const accountSocketInstance = (io: io.Server) => {
  io.on("connection", (socket) => {
    socket.on("createProduct", (newProduct) => {
      socket.broadcast.emit("newProduct", newProduct);
    });

    socket.on("newCartProduct", (cartProduct) => {
      socket.broadcast.emit("cartProduct", cartProduct);
    });
    socket.on("newTranfer", (transfer) => {
      socket.broadcast.emit("transfer", transfer);
    });
  });
};

export default accountSocketInstance;
