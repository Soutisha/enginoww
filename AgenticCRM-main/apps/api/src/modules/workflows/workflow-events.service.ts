import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { prisma } from '@wacrm/database';
import { QUEUES } from '@wacrm/shared';

export interface WorkflowDomainEvent {
  type: string;
  companyId: string;
  entityId?: string;
  contactId?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class WorkflowEventsService {
  private readonly logger = new Logger(WorkflowEventsService.name);

  constructor(@InjectQueue(QUEUES.WORKFLOW_EVENTS) private readonly queue: Queue) {}

  async publish(event: WorkflowDomainEvent): Promise<void> {
    const outbox = await prisma.workflowEventOutbox.create({
      data: {
        companyId: event.companyId,
        eventType: event.type,
        entityId: event.entityId,
        contactId: event.contactId,
        payload: (event.payload ?? {}) as never,
      },
    });
    // Fast path. If Redis is unavailable, the durable outbox scanner will retry.
    try {
      await this.queue.add('dispatch-outbox', { outboxId: outbox.id }, {
        jobId: `workflow-outbox-${outbox.id}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 20000 },
      });
    } catch (error) {
      this.logger.warn(`Workflow event ${outbox.id} stored in outbox; queue fast-path failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
