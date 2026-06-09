import { Request, Response } from 'express';
import { notificationRepository } from '../repository/notification.repository';

const parseEmployeeId = (req: Request, res: Response): number | null => {
  const employeeId = Number(req.params.employeeId);
  if (isNaN(employeeId)) {
    res.status(400).json({ error: 'employeeId inválido' });
    return null;
  }
  return employeeId;
};

export const notificationController = {
  async getAll(req: Request, res: Response) {
    try {
      const employeeId = parseEmployeeId(req, res);
      if (employeeId === null) return;

      const notifications = await notificationRepository.getByEmployee(employeeId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
  },

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const employeeId = parseEmployeeId(req, res);
      if (employeeId === null) return;

      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'id inválido' });
        return;
      }

      const updated = await notificationRepository.markAsRead(id, employeeId);
      if (!updated) {
        res.status(404).json({ error: 'Notificación no encontrada' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al marcar notificación' });
    }
  },

  async markAllAsRead(req: Request, res: Response) {
    try {
      const employeeId = parseEmployeeId(req, res);
      if (employeeId === null) return;

      await notificationRepository.markAllAsRead(employeeId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Error al marcar notificaciones' });
    }
  },

  async getUnreadCount(req: Request, res: Response) {
    try {
      const employeeId = parseEmployeeId(req, res);
      if (employeeId === null) return;

      const count = await notificationRepository.getUnreadCount(employeeId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener conteo' });
    }
  },
};