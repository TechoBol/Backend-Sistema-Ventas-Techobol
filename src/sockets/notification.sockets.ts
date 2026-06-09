import io from "socket.io";

let ioInstance: io.Server;

export const initNotificationSocket = (socket: io.Server): void => {
  ioInstance = socket;
};

export const emitNotification = (notification: object): void => {
  if (!ioInstance) return;
  ioInstance.emit('new_notification', notification);
};