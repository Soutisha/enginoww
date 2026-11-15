import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CallsService, type CreateCallDto } from './calls.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@wacrm/database';

class CallBody implements CreateCallDto {
  @IsString() phoneNumber: string;
  @IsString() @IsOptional() contactId?: string;
  @IsString() @IsOptional() leadId?: string;
  @IsIn(['INBOUND', 'OUTBOUND']) @IsOptional() direction?: string;
  @IsIn(['COMPLETED', 'MISSED', 'BUSY', 'FAILED']) @IsOptional() status?: string;
  @IsString() @IsOptional() provider?: string;
  @IsString() @IsOptional() externalId?: string;
  @IsDateString() @IsOptional() startedAt?: string;
  @IsInt() @Min(0) @IsOptional() durationSeconds?: number;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() transcript?: string;
  @IsString() @IsOptional() summary?: string;
  @IsString() @IsOptional() intent?: string;
  @IsString() @IsOptional() outcome?: string;
  @IsString() @IsOptional() recordingUrl?: string;
}

class UpdateCallBody extends PartialType(CallBody) {}

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@RequirePermissions('leads')
@Controller('calls')
export class CallsController {
  constructor(private readonly svc: CallsService) {}
  @Get() list(@CurrentUser() user: User, @Query('contactId') contactId?: string, @Query('leadId') leadId?: string, @Query('page') page?: string) {
    return this.svc.list(user.companyId, { contactId, leadId, page: page ? Number(page) : 1 });
  }
  @Post() create(@CurrentUser() user: User, @Body() body: CallBody) { return this.svc.create(user.companyId, user, body); }
  @Patch(':id') update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: UpdateCallBody) { return this.svc.update(user.companyId, id, body); }
  @Post(':id/convert-to-lead') convert(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { title?: string }) { return this.svc.convertToLead(user.companyId, user, id, body.title); }
}
