import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { User } from '@wacrm/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MarketingService, MARKETING_TYPES, type BrandProfileInput, type GenerateMarketingInput } from './marketing.service';

class GenerateMarketingBody implements GenerateMarketingInput {
  @IsIn(MARKETING_TYPES) type: GenerateMarketingInput['type'];
  @IsString() @IsOptional() productId?: string;
  @IsString() @IsOptional() @MaxLength(160) productName?: string;
  @IsString() @IsOptional() @MaxLength(1200) productFacts?: string;
  @IsString() @IsOptional() @MaxLength(300) audience?: string;
  @IsString() @IsOptional() @MaxLength(300) objective?: string;
  @IsString() @IsOptional() @MaxLength(500) offer?: string;
  @IsString() @IsOptional() @MaxLength(80) platform?: string;
  @IsString() @IsOptional() @MaxLength(80) channel?: string;
  @IsString() @IsOptional() @MaxLength(120) tone?: string;
  @IsString() @IsOptional() @MaxLength(40) language?: string;
  @IsString() @IsOptional() @MaxLength(2500) context?: string;
  @IsString() @IsOptional() @MaxLength(700) constraints?: string;
  @IsInt() @Min(1) @Max(5) @IsOptional() variants?: number;
  @IsBoolean() @IsOptional() includeHashtags?: boolean;
}

class BrandProfileBody implements BrandProfileInput {
  @IsString() @IsOptional() @MaxLength(120) brandName?: string;
  @IsString() @IsOptional() @MaxLength(240) tagline?: string;
  @IsString() @IsOptional() @MaxLength(300) voice?: string;
  @IsString() @IsOptional() @MaxLength(500) audience?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() valueProps?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() preferredTerms?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() avoidTerms?: string[];
  @IsString() @IsOptional() primaryColor?: string;
  @IsString() @IsOptional() secondaryColor?: string;
  @IsString() @IsOptional() ctaStyle?: string;
  @IsString() @IsOptional() locale?: string;
}

@ApiTags('marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@RequirePermissions('products')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('brand-profile')
  @ApiOperation({ summary: 'Get company marketing voice and visual identity profile' })
  getBrand(@CurrentUser() user: User) {
    return this.marketing.getBrandProfile(user.companyId);
  }

  @Put('brand-profile')
  @ApiOperation({ summary: 'Save company marketing voice and visual identity profile' })
  saveBrand(@CurrentUser() user: User, @Body() body: BrandProfileBody) {
    return this.marketing.saveBrandProfile(user.companyId, body);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a marketing draft using the company-configured AI provider' })
  generate(@CurrentUser() user: User, @Body() body: GenerateMarketingBody) {
    return this.marketing.generate(user.companyId, user.id, body);
  }

  @Get('assets')
  list(@CurrentUser() user: User, @Query('type') type?: string, @Query('limit') limit?: string) {
    return this.marketing.listAssets(user.companyId, type, limit ? Number(limit) : 30);
  }

  @Get('assets/:id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.marketing.getAsset(user.companyId, id);
  }

  @Delete('assets/:id')
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.marketing.deleteAsset(user.companyId, id);
  }
}
