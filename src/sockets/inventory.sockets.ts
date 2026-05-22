import io from "socket.io";

const accountSocketInstance = (io: io.Server) => {
  io.on("connection", (socket) => {
    socket.on("createProduct", (newProduct) => {
      io.emit("newProduct", newProduct);
    });

    socket.on("newCartProduct", (cartProduct) => {
      io.emit("cartProduct", cartProduct);
    });

    socket.on("newTranfer", (transfer) => {
      io.emit("transfer", transfer);
    });
  });
};

export default accountSocketInstance;