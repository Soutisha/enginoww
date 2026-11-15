import {
  Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { User } from '@wacrm/database';
import { ProductVisionService } from './product-vision.service';

@ApiTags('product-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyScopeGuard)
@RequirePermissions('products')
@Controller('products/vision')
export class ProductVisionController {
  constructor(private readonly vision: ProductVisionService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a product image and extract catalogue-ready attributes' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      callback(allowed.includes(file.mimetype) ? null : new BadRequestException('Unsupported image type'), allowed.includes(file.mimetype));
    },
  }))
  analyze(@CurrentUser() user: User, @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number; originalname: string }) {
    if (!file) throw new BadRequestException('Upload one JPEG, PNG, WEBP or GIF image');
    return this.vision.analyze(user.companyId, file);
  }
}
