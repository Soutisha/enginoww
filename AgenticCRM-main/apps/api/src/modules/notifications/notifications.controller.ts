import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@wacrm/database';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  list(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.service.list(user.companyId, user.id, limit ? Number(limit) : 30);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for the authenticated user' })
  markAllRead(@CurrentUser() user: User) {
    return this.service.markAllRead(user.companyId, user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.markRead(user.companyId, user.id, id);
  }
}
