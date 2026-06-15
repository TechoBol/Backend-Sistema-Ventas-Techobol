import io from "socket.io";

const employeeSocketInstance = (io: io.Server) => {
  io.on("connection", (socket) => {

    socket.on("joinEmployeeRoom", (employeeId) => {
      socket.join(`employee_${employeeId}`);

      console.log(
        `Socket ${socket.id} joined room employee_${employeeId}`
      );
    });

    socket.on("createEmployee", (employee) => {
      socket.broadcast.emit("employeeUpdated", employee);
    });

    socket.on("deleteEmployee", (employeeId) => {
      socket.broadcast.emit("employeeRemoved", employeeId);
    });

  });
};

export default employeeSocketInstance;