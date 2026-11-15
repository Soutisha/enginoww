import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

const DEMO_MARKER = 'bizpilot-demo-v1';
const DEMO_PROVIDER = 'bizpilot-demo-v1';

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const ahead = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const demoTags = ['demo', DEMO_MARKER];

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

  private assertAdmin(role: string) {
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only workspace administrators can manage demo data');
    }
  }

  async getDemoDataStatus(companyId: string) {
    const [contacts, leads, deals, tasks, products, payments, accounts] = await Promise.all([
      prisma.contact.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.lead.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.deal.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.task.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.product.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.payment.count({ where: { companyId, tags: { has: DEMO_MARKER } } }),
      prisma.whatsAppAccount.findMany({
        where: { companyId, provider: DEMO_PROVIDER },
        select: { id: true },
      }),
    ]);
    const conversations = accounts.length
      ? await prisma.conversation.count({
          where: { companyId, whatsappAccountId: { in: accounts.map((account) => account.id) } },
        })
      : 0;
    const counts = { contacts, leads, deals, tasks, products, payments, conversations };
    return {
      loaded: Object.values(counts).some((count) => count > 0),
      counts,
      note: 'Demo-tagged records are fictional. Demo payments are simulated and are not actual revenue.',
    };
  }

  async loadDemoData(companyId: string, userId: string, role: string) {
    this.assertAdmin(role);
    await this.get(companyId);

    const result = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: userId, companyId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      if (!actor) throw new ForbiddenException('A workspace administrator is required');

      const existing = await tx.contact.count({
        where: { companyId, tags: { has: DEMO_MARKER } },
      });
      if (existing > 0) return { alreadyLoaded: true };

      const contactSpecs = [
        { phoneNumber: '000000000101', firstName: 'Aarav', lastName: 'Mehta', email: 'aarav.mehta@example.invalid', companyName: 'Northstar Retail', jobTitle: 'Operations Head', score: 92 },
        { phoneNumber: '000000000102', firstName: 'Diya', lastName: 'Sharma', email: 'diya.sharma@example.invalid', companyName: 'BluePeak Foods', jobTitle: 'Founder', score: 88 },
        { phoneNumber: '000000000103', firstName: 'Kabir', lastName: 'Sen', email: 'kabir.sen@example.invalid', companyName: 'UrbanNest', jobTitle: 'Purchase Manager', score: 76 },
        { phoneNumber: '000000000104', firstName: 'Mira', lastName: 'Roy', email: 'mira.roy@example.invalid', companyName: 'GreenCart', jobTitle: 'Marketing Lead', score: 64 },
        { phoneNumber: '000000000105', firstName: 'Ishaan', lastName: 'Das', email: 'ishaan.das@example.invalid', companyName: 'PixelCraft', jobTitle: 'Director', score: 84 },
      ];

      const contacts = [];
      for (const person of contactSpecs) {
        const contact = await tx.contact.create({
          data: {
            companyId,
            ...person,
            displayName: `${person.firstName} ${person.lastName}`,
            lifecycleStage: 'LEAD',
            tags: demoTags,
            notes: 'DEMO ONLY — fictional sample contact; not a real customer.',
          },
        });
        contacts.push(contact);
      }

      const productSpecs = [
        { sku: 'BIZPILOT-DEMO-001', name: 'BizPilot Growth CRM', category: 'Software', price: 18500000, stock: 120 },
        { sku: 'BIZPILOT-DEMO-002', name: 'Workflow Automation Pack', category: 'Automation', price: 24500000, stock: 80 },
        { sku: 'BIZPILOT-DEMO-003', name: 'Digital Storefront Starter', category: 'Commerce', price: 39000000, stock: 45 },
      ];
      const products = [];
      for (const product of productSpecs) {
        const created = await tx.product.create({
          data: {
            companyId,
            ...product,
            currency: 'INR',
            trackInventory: true,
            reorderLevel: 10,
            tags: demoTags,
            description: 'DEMO ONLY — fictional product for demonstrating BizPilot.',
          },
        });
        products.push(created);
      }

      const leadSpecs = [
        { title: 'DEMO — Retail inventory automation enquiry', status: 'QUALIFIED' as const, source: 'WEBSITE' as const, priority: 'HIGH' as const, estimatedValue: 185000, probability: 75 },
        { title: 'DEMO — Restaurant growth platform enquiry', status: 'PROPOSAL_SENT' as const, source: 'REFERRAL' as const, priority: 'URGENT' as const, estimatedValue: 245000, probability: 80 },
        { title: 'DEMO — Storefront and CRM evaluation', status: 'CONTACTED' as const, source: 'WHATSAPP' as const, priority: 'MEDIUM' as const, estimatedValue: 96000, probability: 45 },
        { title: 'DEMO — Marketing automation enquiry', status: 'NEW' as const, source: 'CAMPAIGN' as const, priority: 'MEDIUM' as const, estimatedValue: 72000, probability: 25 },
        { title: 'DEMO — Enterprise CRM pilot', status: 'WON' as const, source: 'MANUAL' as const, priority: 'HIGH' as const, estimatedValue: 390000, probability: 100 },
      ];
      const leads = [];
      for (let i = 0; i < leadSpecs.length; i++) {
        const spec = leadSpecs[i];
        const lead = await tx.lead.create({
          data: {
            companyId,
            contactId: contacts[i].id,
            ...spec,
            score: contactSpecs[i].score,
            currency: 'INR',
            tags: demoTags,
            notes: 'DEMO ONLY — fictional opportunity for dashboard demonstrations.',
            expectedCloseAt: ahead(14 + i),
            ...(spec.status === 'WON' ? { wonAt: ago(2) } : {}),
          },
        });
        leads.push(lead);
      }

      const dealSpecs = [
        { title: 'DEMO — Northstar Retail growth CRM rollout', stage: 'PROPOSAL' as const, value: 185000, probability: 70, productIndex: 0, contactIndex: 0 },
        { title: 'DEMO — BluePeak Foods automation deployment', stage: 'NEGOTIATION' as const, value: 245000, probability: 80, productIndex: 1, contactIndex: 1 },
        { title: 'DEMO — PixelCraft enterprise pilot', stage: 'WON' as const, value: 390000, probability: 100, productIndex: 2, contactIndex: 4 },
      ];
      const deals = [];
      for (const spec of dealSpecs) {
        const deal = await tx.deal.create({
          data: {
            companyId,
            contactId: contacts[spec.contactIndex].id,
            leadId: leads[spec.contactIndex].id,
            title: spec.title,
            stage: spec.stage,
            source: 'MANUAL',
            priority: 'HIGH',
            value: spec.value,
            currency: 'INR',
            probability: spec.probability,
            weightedValue: spec.value * spec.probability / 100,
            tags: demoTags,
            notes: 'DEMO ONLY — fictional deal; not a real customer commitment.',
            expectedCloseAt: ahead(20),
            ...(spec.stage === 'WON' ? { wonAt: ago(2) } : {}),
            lineItems: {
              create: {
                companyId,
                productId: products[spec.productIndex].id,
                name: products[spec.productIndex].name,
                quantity: 1,
                unitPrice: spec.value,
                total: spec.value,
              },
            },
          },
        });
        deals.push(deal);
      }

      const taskSpecs = [
        { title: 'DEMO — Call Northstar Retail decision maker', status: 'TODO' as const, priority: 'HIGH' as const, leadIndex: 0, dealIndex: 0, contactIndex: 0 },
        { title: 'DEMO — Send BluePeak Foods proposal walkthrough', status: 'IN_PROGRESS' as const, priority: 'URGENT' as const, leadIndex: 1, dealIndex: 1, contactIndex: 1 },
        { title: 'DEMO — Prepare enterprise pilot scope', status: 'TODO' as const, priority: 'MEDIUM' as const, leadIndex: 4, dealIndex: 2, contactIndex: 4 },
      ];
      for (let i = 0; i < taskSpecs.length; i++) {
        const spec = taskSpecs[i];
        await tx.task.create({
          data: {
            companyId,
            title: spec.title,
            status: spec.status,
            priority: spec.priority,
            source: 'MANUAL',
            contactId: contacts[spec.contactIndex].id,
            leadId: leads[spec.leadIndex].id,
            dealId: deals[spec.dealIndex].id,
            assignedAgentId: userId,
            createdById: userId,
            dueAt: ahead(i + 1),
            tags: demoTags,
            description: 'DEMO ONLY — sample task. No external customer action has been taken.',
          },
        });
      }

      // Simulated payments make revenue charts useful in a demo. They are
      // conspicuously tagged and described as fictional; no gateway is called.
      const paymentSpecs = [
        { contactIndex: 0, dealIndex: 0, amount: 3500000, day: 3 },
        { contactIndex: 1, dealIndex: 1, amount: 6200000, day: 8 },
        { contactIndex: 4, dealIndex: 2, amount: 12500000, day: 12 },
      ];
      for (let i = 0; i < paymentSpecs.length; i++) {
        const spec = paymentSpecs[i];
        await tx.payment.create({
          data: {
            companyId,
            contactId: contacts[spec.contactIndex].id,
            dealId: deals[spec.dealIndex].id,
            provider: 'NONE',
            method: 'demo-simulated',
            amount: spec.amount,
            currency: 'INR',
            description: 'DEMO ONLY — simulated payment; not real revenue.',
            notes: 'Fictional payment generated only to demonstrate revenue analytics.',
            tags: demoTags,
            status: 'PAID',
            paidAt: ago(spec.day),
            idempotencyKey: `${companyId}:${DEMO_MARKER}:payment-${i + 1}`,
            createdByUserId: userId,
          },
        });
      }

      // This inbox is explicitly disconnected and cannot send WhatsApp messages.
      const demoAccount = await tx.whatsAppAccount.create({
        data: {
          companyId,
          userId,
          phoneNumber: '000000000000',
          displayName: 'Demo Inbox (offline samples)',
          provider: DEMO_PROVIDER,
          status: 'DISCONNECTED',
          allowedNumbers: [],
        },
      });
      const conversationSpecs = [
        { contactIndex: 0, status: 'OPEN' as const, body: 'DEMO: Hi, I would like to see how inventory automation works for our retail stores.', daysAgo: 1 },
        { contactIndex: 1, status: 'WAITING_HUMAN' as const, body: 'DEMO: Can someone share the proposal and implementation timeline?', daysAgo: 2 },
        { contactIndex: 2, status: 'RESOLVED' as const, body: 'DEMO: I need information about the storefront and CRM package.', daysAgo: 4 },
      ];
      for (let i = 0; i < conversationSpecs.length; i++) {
        const spec = conversationSpecs[i];
        const createdAt = ago(spec.daysAgo);
        const conversation = await tx.conversation.create({
          data: {
            companyId,
            contactId: contacts[spec.contactIndex].id,
            whatsappAccountId: demoAccount.id,
            assignedAgentId: userId,
            status: spec.status,
            aiEnabled: false,
            unreadCount: spec.status === 'OPEN' ? 1 : 0,
            lastMessageAt: createdAt,
            lastMessageText: spec.body,
            ...(spec.status === 'RESOLVED' ? { resolvedAt: ago(1) } : {}),
            metadata: {
              demoMarker: DEMO_MARKER,
              notice: 'Fictional sample conversation. No WhatsApp message was sent.',
            },
          },
        });
        await tx.message.create({
          data: {
            companyId,
            conversationId: conversation.id,
            whatsappAccountId: demoAccount.id,
            whatsappMessageId: `${DEMO_MARKER}-${i + 1}`,
            idempotencyKey: `${companyId}:${DEMO_MARKER}:message-${i + 1}`,
            direction: 'INBOUND',
            type: 'TEXT',
            status: 'DELIVERED',
            body: spec.body,
            createdAt,
          },
        });
      }

      return { alreadyLoaded: false };
    }, { maxWait: 10_000, timeout: 30_000 });

    const status = await this.getDemoDataStatus(companyId);
    return {
      alreadyLoaded: result.alreadyLoaded,
      ...status,
      message: result.alreadyLoaded
        ? 'Demo data is already loaded. No duplicate records were created.'
        : 'Demo workspace data was created successfully.',
    };
  }

  async clearDemoData(companyId: string, userId: string, role: string, confirmation: string) {
    this.assertAdmin(role);
    if (confirmation !== 'DELETE_DEMO_DATA') {
      throw new BadRequestException('Confirmation is required to remove demo data');
    }

    await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: userId, companyId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      if (!actor) throw new ForbiddenException('A workspace administrator is required');

      const [contacts, leads, deals, products, demoAccounts] = await Promise.all([
        tx.contact.findMany({ where: { companyId, tags: { has: DEMO_MARKER } }, select: { id: true } }),
        tx.lead.findMany({ where: { companyId, tags: { has: DEMO_MARKER } }, select: { id: true } }),
        tx.deal.findMany({ where: { companyId, tags: { has: DEMO_MARKER } }, select: { id: true } }),
        tx.product.findMany({ where: { companyId, tags: { has: DEMO_MARKER } }, select: { id: true } }),
        tx.whatsAppAccount.findMany({ where: { companyId, provider: DEMO_PROVIDER }, select: { id: true } }),
      ]);
      const contactIds = contacts.map((item) => item.id);
      const leadIds = leads.map((item) => item.id);
      const dealIds = deals.map((item) => item.id);
      const productIds = products.map((item) => item.id);
      const accountIds = demoAccounts.map((item) => item.id);

      // Refuse cleanup if a real record has been linked to a demo record.
      const references = await Promise.all([
        contactIds.length ? tx.lead.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.deal.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.task.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.payment.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.ticket.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.quote.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.invoice.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.document.count({ where: { companyId, contactId: { in: contactIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        contactIds.length ? tx.callRecord.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.callLog.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.contactNote.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.sequenceEnrollment.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.broadcastRecipient.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.campaignRecipient.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.formSubmission.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.workflowExecution.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.workflowEventOutbox.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.calendarEvent.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        contactIds.length ? tx.activityLog.count({ where: { companyId, contactId: { in: contactIds } } }) : 0,
        leadIds.length ? tx.deal.count({ where: { companyId, leadId: { in: leadIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        leadIds.length ? tx.task.count({ where: { companyId, leadId: { in: leadIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        leadIds.length ? tx.callRecord.count({ where: { companyId, leadId: { in: leadIds } } }) : 0,
        leadIds.length ? tx.formSubmission.count({ where: { companyId, leadId: { in: leadIds } } }) : 0,
        dealIds.length ? tx.task.count({ where: { companyId, dealId: { in: dealIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        dealIds.length ? tx.quote.count({ where: { companyId, dealId: { in: dealIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        dealIds.length ? tx.invoice.count({ where: { companyId, dealId: { in: dealIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        dealIds.length ? tx.calendarEvent.count({ where: { companyId, dealId: { in: dealIds } } }) : 0,
        dealIds.length ? tx.document.count({ where: { companyId, dealId: { in: dealIds }, NOT: { tags: { has: DEMO_MARKER } } } }) : 0,
        dealIds.length ? tx.activityLog.count({ where: { companyId, entityId: { in: dealIds } } }) : 0,
        productIds.length ? tx.dealLineItem.count({ where: { companyId, productId: { in: productIds }, deal: { NOT: { tags: { has: DEMO_MARKER } } } } }) : 0,
        productIds.length ? tx.quoteLineItem.count({ where: { productId: { in: productIds }, quote: { NOT: { tags: { has: DEMO_MARKER } } } } }) : 0,
        productIds.length ? tx.invoiceLineItem.count({ where: { productId: { in: productIds }, invoice: { NOT: { tags: { has: DEMO_MARKER } } } } }) : 0,
      ]);
      if (references.some((count) => count > 0)) {
        throw new BadRequestException(
          'Some demo records are linked to non-demo business records. Unlink those records before cleanup; nothing was deleted.',
        );
      }

      const demoAccountRows = accountIds.length
        ? await tx.whatsAppAccount.findMany({
            where: { companyId, id: { in: accountIds } },
            select: { id: true, status: true },
          })
        : [];
      if (demoAccountRows.some((account) => account.status !== 'DISCONNECTED')) {
        throw new BadRequestException('A demo inbox is no longer disconnected. Nothing was deleted.');
      }

      const conversations = accountIds.length
        ? await tx.conversation.findMany({
            where: { companyId, whatsappAccountId: { in: accountIds } },
            select: { id: true, metadata: true },
          })
        : [];
      const unsafeConversationIds = conversations
        .filter((conversation) => {
          const metadata = conversation.metadata as { demoMarker?: string } | null;
          return metadata?.demoMarker !== DEMO_MARKER;
        })
        .map((conversation) => conversation.id);
      if (unsafeConversationIds.length) {
        throw new BadRequestException('The demo inbox contains a non-demo conversation. Nothing was deleted.');
      }
      const conversationIds = conversations.map((item) => item.id);

      if (conversationIds.length) {
        const messages = await tx.message.findMany({
          where: { companyId, conversationId: { in: conversationIds } },
          select: { idempotencyKey: true },
        });
        if (messages.some((message) => !message.idempotencyKey?.includes(DEMO_MARKER))) {
          throw new BadRequestException('The demo inbox contains a non-demo message. Nothing was deleted.');
        }
        await tx.message.deleteMany({ where: { companyId, conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { companyId, id: { in: conversationIds } } });
      }
      if (accountIds.length) {
        await tx.whatsAppAccount.deleteMany({ where: { companyId, id: { in: accountIds } } });
      }

      await tx.payment.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
      await tx.task.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
      await tx.deal.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
      await tx.lead.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
      await tx.product.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
      await tx.contact.deleteMany({ where: { companyId, tags: { has: DEMO_MARKER } } });
    }, { maxWait: 10_000, timeout: 30_000 });

    return {
      loaded: false,
      counts: { contacts: 0, leads: 0, deals: 0, tasks: 0, products: 0, payments: 0, conversations: 0 },
      message: 'Only BizPilot demo records were removed. Real business records were not modified.',
    };
  }
}
