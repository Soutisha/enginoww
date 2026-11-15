import { Module } from '@nestjs/common';
import { ProductsController, PublicStorefrontController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, PublicStorefrontController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
