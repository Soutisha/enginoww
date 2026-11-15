import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@wacrm/database';
import { AgentsService } from './agents.service';
@ApiTags('agents') @ApiBearerAuth() @UseGuards(JwtAuthGuard, CompanyScopeGuard) @RequirePermissions('ai_chat') @Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}
  @Get('workforce') list(@CurrentUser() user: User) { return this.service.list(user.companyId); }
  @Get('workforce/:id') get(@CurrentUser() user: User, @Param('id') id: string) { return this.service.get(user.companyId, id); }
  @Post('workforce') create(@CurrentUser() user: User, @Body() body: { title: string; objective: string; agents: string[]; sharedContext?: Record<string, unknown> }) { return this.service.create(user.companyId, user.id, body); }
  @Post('workforce/:id/approve') approve(@CurrentUser() user: User, @Param('id') id: string) { return this.service.approve(user.companyId, user.id, id); }
  @Post('workforce/:id/reject') reject(@CurrentUser() user: User, @Param('id') id: string) { return this.service.reject(user.companyId, id); }
}
