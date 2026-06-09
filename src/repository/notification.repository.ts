import prisma from '../config/db';
import { NotificationType } from '@prisma/client';
import { emitNotification } from '../sockets/notification.sockets';

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  body: string;
  saleId?: number;
  transferId?: number;
  quotationId?: number;
  importacionId?: number;
}

export const notificationRepository = {

  async createForAll(data: CreateNotificationParams) {
    const employees = await prisma.employee.findMany({
      where: { isVisible: true },
      select: { id: true },
    });

    const notification = await prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        body: data.body,
        saleId: data.saleId,
        transferId: data.transferId,
        quotationId: data.quotationId,
        importacionId: data.importacionId,
        reads: {
          createMany: {
            data: employees.map((e) => ({ employeeId: e.id })),
          },
        },
      },
    });

    emitNotification({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt,
      isRead: false,
    });

    return notification;
  },

  async getByEmployee(employeeId: number) {
    const reads = await prisma.notificationRead.findMany({
      where: { employeeId },
      orderBy: { notification: { createdAt: 'desc' } },
      take: 50,
      include: {
        notification: {
          include: {
            sale: { select: { id: true, code: true, total: true } },
            transfer: { select: { id: true, transferCode: true } },
            quotation: { select: { id: true, code: true } },
            importacion: { select: { id: true, code: true } },
          },
        },
      },
    });

    return reads.map((r) => ({
      id: r.notification.id,
      type: r.notification.type,
      title: r.notification.title,
      body: r.notification.body,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.notification.createdAt,
      sale: r.notification.sale,
      transfer: r.notification.transfer,
      quotation: r.notification.quotation,
      importacion: r.notification.importacion,
    }));
  },

  async markAsRead(notificationId: number, employeeId: number): Promise<boolean> {
    const result = await prisma.notificationRead.updateMany({
      where: { notificationId, employeeId },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count > 0;
  },

  async markAllAsRead(employeeId: number) {
    return prisma.notificationRead.updateMany({
      where: { employeeId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async getUnreadCount(employeeId: number) {
    return prisma.notificationRead.count({
      where: { employeeId, isRead: false },
    });
  },
};