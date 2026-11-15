import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadIntelligenceService } from './lead-intelligence.service';

@Module({
  imports: [WorkflowsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadIntelligenceService],
  exports: [LeadsService],
})
export class LeadsModule {}
