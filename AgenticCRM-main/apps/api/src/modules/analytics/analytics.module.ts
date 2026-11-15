import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { OverviewService } from './overview.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { CommandCentreService } from './command-centre.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OverviewService, PredictiveAnalyticsService, CommandCentreService],
})
export class AnalyticsModule {}
