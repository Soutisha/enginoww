import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { LeadsModule } from '../leads/leads.module';
@Module({ imports: [LeadsModule], controllers: [CallsController], providers: [CallsService], exports: [CallsService] })
export class CallsModule {}
