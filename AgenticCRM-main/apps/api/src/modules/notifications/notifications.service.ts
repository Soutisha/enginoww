import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@wacrm/database';

@Injectable()
export class NotificationsService {
  async list(companyId: string, userId: string, limit = 30) {
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const where = { companyId, userId };
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(companyId: string, userId: string, id: string) {
    const result = await prisma.notification.updateMany({
      where: { id, companyId, userId, read: false },
      data: { read: true },
    });
    if (result.count === 0) {
      const existing = await prisma.notification.findFirst({
        where: { id, companyId, userId },
        select: { id: true, read: true },
      });
      if (!existing) throw new NotFoundException('Notification not found');
      return existing;
    }
    return prisma.notification.findFirst({
      where: { id, companyId, userId },
      select: { id: true, read: true },
    });
  }

  async markAllRead(companyId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { companyId, userId, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }
}
