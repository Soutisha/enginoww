import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@wacrm/database';
import { LeadsService } from '../leads/leads.service';
import type { User } from '@wacrm/database';

export interface CreateCallDto {
  contactId?: string;
  leadId?: string;
  phoneNumber: string;
  direction?: string;
  status?: string;
  provider?: string;
  externalId?: string;
  startedAt?: string;
  durationSeconds?: number;
  notes?: string;
  transcript?: string;
  summary?: string;
  intent?: string;
  outcome?: string;
  recordingUrl?: string;
}

@Injectable()
export class CallsService {
  constructor(private readonly leads: LeadsService) {}

  async list(companyId: string, filters: { contactId?: string; leadId?: string; page?: number } = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const where = { companyId, ...(filters.contactId ? { contactId: filters.contactId } : {}), ...(filters.leadId ? { leadId: filters.leadId } : {}) };
    const [items, total] = await Promise.all([
      prisma.callRecord.findMany({ where, orderBy: { startedAt: 'desc' }, skip: (page - 1) * 30, take: 30, include: { contact: { select: { id: true, displayName: true, phoneNumber: true } }, lead: { select: { id: true, title: true, status: true } } } }),
      prisma.callRecord.count({ where }),
    ]);
    return { items, total, page, limit: 30 };
  }

  async create(companyId: string, user: User, dto: CreateCallDto) {
    if (!dto.phoneNumber?.trim()) throw new BadRequestException('Phone number is required');
    if (dto.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: dto.contactId, companyId, deletedAt: null }, select: { id: true } });
      if (!contact) throw new NotFoundException('Contact not found');
    }
    if (dto.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: dto.leadId, companyId, deletedAt: null }, select: { id: true, contactId: true } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (dto.contactId && lead.contactId !== dto.contactId) throw new BadRequestException('Call contact must match the linked lead contact');
      if (!dto.contactId) dto.contactId = lead.contactId;
    }
    if (dto.provider && dto.externalId) {
      const existing = await prisma.callRecord.findFirst({ where: { companyId, provider: dto.provider, externalId: dto.externalId } });
      if (existing) return existing;
    }
    return prisma.callRecord.create({ data: {
      companyId, contactId: dto.contactId, leadId: dto.leadId, phoneNumber: dto.phoneNumber.trim(),
      direction: dto.direction ?? 'OUTBOUND', status: dto.status ?? 'COMPLETED', provider: dto.provider,
      externalId: dto.externalId, startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      durationSeconds: Math.max(0, Math.floor(dto.durationSeconds ?? 0)), notes: dto.notes,
      transcript: dto.transcript, summary: dto.summary, intent: dto.intent, outcome: dto.outcome,
      recordingUrl: dto.recordingUrl, createdById: user.id,
    } });
  }

  async update(companyId: string, id: string, dto: Partial<CreateCallDto>) {
    const call = await prisma.callRecord.findFirst({ where: { id, companyId } });
    if (!call) throw new NotFoundException('Call record not found');
    if (dto.contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: dto.contactId, companyId, deletedAt: null }, select: { id: true } });
      if (!contact) throw new NotFoundException('Contact not found');
    }
    const effectiveLeadId = dto.leadId ?? call.leadId;
    let inferredContactId: string | undefined;
    if (effectiveLeadId) {
      const lead = await prisma.lead.findFirst({ where: { id: effectiveLeadId, companyId, deletedAt: null }, select: { id: true, contactId: true } });
      if (!lead) throw new NotFoundException('Lead not found');
      const effectiveContactId = dto.contactId ?? call.contactId;
      if (effectiveContactId && lead.contactId !== effectiveContactId) throw new BadRequestException('Call contact must match the linked lead contact');
      if (!effectiveContactId) inferredContactId = lead.contactId;
    }
    return prisma.callRecord.update({ where: { id }, data: {
      ...(dto.contactId !== undefined ? { contactId: dto.contactId } : inferredContactId ? { contactId: inferredContactId } : {}), ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}), ...(dto.transcript !== undefined ? { transcript: dto.transcript } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}), ...(dto.intent !== undefined ? { intent: dto.intent } : {}),
      ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.durationSeconds !== undefined ? { durationSeconds: Math.max(0, Math.floor(dto.durationSeconds)) } : {}),
      ...(dto.recordingUrl !== undefined ? { recordingUrl: dto.recordingUrl } : {}),
    } });
  }

  async convertToLead(companyId: string, user: User, id: string, title?: string) {
    const call = await prisma.callRecord.findFirst({ where: { id, companyId } });
    if (!call) throw new NotFoundException('Call record not found');
    if (!call.contactId) throw new BadRequestException('Link this call to a contact before creating a lead');
    if (call.leadId) return prisma.lead.findFirst({ where: { id: call.leadId, companyId } });
    const lead = await this.leads.create(companyId, {
      contactId: call.contactId,
      title: title?.trim() || `Call follow-up: ${call.phoneNumber}`,
      source: 'OTHER',
      notes: [call.summary, call.notes].filter(Boolean).join('\n\n') || undefined,
    }, { type: 'user', userId: user.id });
    await prisma.callRecord.update({ where: { id }, data: { leadId: lead.id } });
    return lead;
  }
}
