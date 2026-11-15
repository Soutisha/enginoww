import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@wacrm/shared';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowEventsService } from './workflow-events.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.WORKFLOW_EVENTS })],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowEventsService],
  exports: [WorkflowsService, WorkflowEventsService],
})
export class WorkflowsModule {}
