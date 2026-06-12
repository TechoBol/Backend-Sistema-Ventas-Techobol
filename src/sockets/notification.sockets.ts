import { Server, Socket } from 'socket.io';

let ioInstance: Server;

export const initNotificationSocket = (io: Server): void => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    socket.on('join', (employeeId: number) => {
      socket.join(`employee_${employeeId}`);
    });
  });
};

export const emitNotification = (notification: object): void => {
  if (!ioInstance) return;
  ioInstance.emit('new_notification', notification);
};