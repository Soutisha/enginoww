import { Module } from '@nestjs/common';
import { ProductVisionController } from './product-vision.controller';
import { ProductVisionService } from './product-vision.service';

@Module({
  controllers: [ProductVisionController],
  providers: [ProductVisionService],
})
export class ProductVisionModule {}
