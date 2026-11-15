import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@wacrm/database';

export interface UpdateCompanyDto {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  publicUrl?: string;
  timezone?: string;
  storefrontEnabled?: boolean;
  storefrontDescription?: string;
  storefrontBannerUrl?: string;
  storefrontAccentColor?: string;
}

@Injectable()
export class CompanyService {
  async get(companyId: string) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.get(companyId);
    if (dto.storefrontAccentColor && !/^#[0-9a-fA-F]{6}$/.test(dto.storefrontAccentColor)) {
      throw new BadRequestException('Storefront accent colour must be a 6-digit hex colour');
    }
    return prisma.company.update({ where: { id: companyId }, data: dto });
  }

  async markSetupDone(companyId: string) {
    return prisma.company.update({ where: { id: companyId }, data: { setupDone: true } });
  }

  async getSetupStatus(companyId: string) {
    const company = await this.get(companyId);
    const [aiConfig, paymentConfig, whatsappAccounts] = await Promise.all([
      prisma.aiConfig.findUnique({ where: { companyId } }),
      prisma.paymentConfig.findUnique({ where: { companyId } }),
      prisma.whatsAppAccount.findMany({ where: { companyId }, select: { id: true, status: true, phoneNumber: true } }),
    ]);

    const steps = {
      companyProfile: !!(company.name && company.email),
      whatsappConnected: whatsappAccounts.some((a) => a.status === 'CONNECTED'),
      aiConfigured: !!(aiConfig?.apiKeyEncrypted && aiConfig.autoReplyEnabled !== undefined),
      paymentConfigured: !!(paymentConfig && paymentConfig.provider !== 'NONE'),
      setupDone: company.setupDone,
    };

    return { steps, setupDone: company.setupDone, company };
  }
}
