import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments.webhook';
import { PaymentsService } from './payments.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [forwardRef(() => InvoicesModule), WorkflowsModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
