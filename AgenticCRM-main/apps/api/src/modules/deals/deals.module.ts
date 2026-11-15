import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({
  imports: [WorkflowsModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
