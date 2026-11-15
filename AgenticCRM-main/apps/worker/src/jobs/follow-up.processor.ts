/**
 * Follow-up processor — runs every 30 minutes.
 * Creates a persisted, user-scoped notification for stale WAITING_HUMAN conversations.
 * A conversation is notified at most once per 24 hours to avoid repeat-job spam.
 */
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { prisma } from '@wacrm/database';
import { QUEUES } from '@wacrm/shared';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const FOLLOW_UP_THRESHOLD_MINUTES = Number(process.env.FOLLOW_UP_THRESHOLD_MINUTES ?? 30);
const NOTIFICATION_DEDUPE_HOURS = 24;

export function startFollowUpProcessor(): Worker {
  const worker = new Worker(
    QUEUES.FOLLOW_UP,
    async (_job: Job) => {
      const cutoff = new Date(Date.now() - FOLLOW_UP_THRESHOLD_MINUTES * 60 * 1000);
      const dedupeSince = new Date(Date.now() - NOTIFICATION_DEDUPE_HOURS * 60 * 60 * 1000);

      const stale = await prisma.conversation.findMany({
        where: {
          status: 'WAITING_HUMAN',
          lastMessageAt: { lt: cutoff },
        },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { displayName: true, phoneNumber: true } },
          assignedAgent: { select: { id: true, email: true, firstName: true } },
        },
        take: 50,
      });

      let notificationsCreated = 0;
      for (const conv of stale) {
        const recipients = conv.assignedAgentId
          ? [conv.assignedAgentId]
          : (await prisma.user.findMany({
              where: {
                companyId: conv.companyId,
                isActive: true,
                role: { in: ['SUPER_ADMIN', 'ADMIN'] },
              },
              select: { id: true },
            })).map((user) => user.id);

        if (recipients.length === 0) {
          logger.warn({ conversationId: conv.id, companyId: conv.companyId }, 'No active notification recipient for stale conversation');
          continue;
        }

        const contactName = conv.contact.displayName ?? conv.contact.phoneNumber;
        const link = `/inbox?conversationId=${encodeURIComponent(conv.id)}`;
        for (const userId of recipients) {
          const existing = await prisma.notification.findFirst({
            where: {
              companyId: conv.companyId,
              userId,
              type: 'FOLLOW_UP_NEEDED',
              link,
              createdAt: { gte: dedupeSince },
            },
            select: { id: true },
          });
          if (existing) continue;

          await prisma.notification.create({
            data: {
              companyId: conv.companyId,
              userId,
              type: 'FOLLOW_UP_NEEDED',
              title: 'Follow-up needed',
              body: `Conversation with ${contactName} has been waiting for ${FOLLOW_UP_THRESHOLD_MINUTES} minutes`,
              link,
            },
          });
          notificationsCreated += 1;
        }
      }

      logger.info({ processed: stale.length, notificationsCreated }, 'Follow-up notifications processed');
      return { processed: stale.length, notificationsCreated };
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'follow-up job failed');
  });

  logger.info('Follow-up processor started');
  return worker;
}
