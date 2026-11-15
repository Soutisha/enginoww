import { Controller, Get, Patch, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompanyService, UpdateCompanyDto } from './company.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '@wacrm/database';

@ApiTags('company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly svc: CompanyService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.svc.get(user.companyId);
  }

  @Patch()
  update(@CurrentUser() user: User, @Body() body: UpdateCompanyDto) {
    return this.svc.update(user.companyId, body);
  }

  @Get('setup-status')
  @ApiOperation({ summary: 'Get setup wizard step completion status' })
  setupStatus(@CurrentUser() user: User) {
    return this.svc.getSetupStatus(user.companyId);
  }

  @Post('setup-complete')
  @ApiOperation({ summary: 'Mark setup wizard as completed' })
  markSetupDone(@CurrentUser() user: User) {
    return this.svc.markSetupDone(user.companyId);
  }

  @Get('demo-data')
  @ApiOperation({ summary: 'Get counts of clearly marked demo records in this workspace' })
  demoDataStatus(@CurrentUser() user: User) {
    return this.svc.getDemoDataStatus(user.companyId);
  }

  @Post('demo-data/load')
  @ApiOperation({ summary: 'Load fictional, clearly marked CRM demo records for workspace administrators' })
  loadDemoData(@CurrentUser() user: User) {
    return this.svc.loadDemoData(user.companyId, user.id, user.role);
  }

  @Delete('demo-data')
  @ApiOperation({ summary: 'Remove only marked demo records after explicit confirmation' })
  clearDemoData(
    @CurrentUser() user: User,
    @Body() body: { confirmation?: string },
  ) {
    return this.svc.clearDemoData(user.companyId, user.id, user.role, body?.confirmation ?? '');
  }
}
