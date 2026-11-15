import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@wacrm/database';
import {
  classifyIntent,
  evaluateModel,
  explainPrediction,
  extractLeadFeatures,
  LEAD_FEATURES,
  predictProbability,
  splitTrainingExamples,
  trainLogisticRegression,
  type LogisticModel,
  type TrainingExample,
} from './lead-intelligence';

const MIN_TOTAL_SAMPLES = 20;
const MIN_PER_CLASS = 5;
const TERMINAL_STATUSES = ['WON', 'LOST', 'DISQUALIFIED'] as const;

@Injectable()
export class LeadIntelligenceService {
  async modelStatus(companyId: string) {
    const model = await prisma.leadScoringModel.findUnique({ where: { companyId } });
    if (!model) return { trained: false, minimumSamples: MIN_TOTAL_SAMPLES, minimumPerClass: MIN_PER_CLASS };
    return {
      trained: true,
      version: model.version,
      trainedAt: model.trainedAt,
      trainingSamples: model.trainingSamples,
      positiveSamples: model.positiveSamples,
      negativeSamples: model.negativeSamples,
      featureNames: model.featureNames,
      metrics: model.metrics,
    };
  }

  async train(companyId: string) {
    const leads = await prisma.lead.findMany({
      where: { companyId, deletedAt: null, status: { in: [...TERMINAL_STATUSES] } },
      select: {
        id: true,
        status: true,
        estimatedValue: true,
        priority: true,
        source: true,
        tags: true,
        assignedAgentId: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });

    const examples: TrainingExample[] = leads.map((lead: { id: string; status: string; estimatedValue: number | null; priority: string; source: string; tags: string[]; assignedAgentId: string | null }) => ({
      id: lead.id,
      label: lead.status === 'WON' ? 1 : 0,
      features: extractLeadFeatures(lead),
    }));
    const positiveSamples = examples.filter((example) => example.label === 1).length;
    const negativeSamples = examples.length - positiveSamples;
    if (examples.length < MIN_TOTAL_SAMPLES || positiveSamples < MIN_PER_CLASS || negativeSamples < MIN_PER_CLASS) {
      throw new BadRequestException({
        message: `Insufficient resolved lead history to train a reliable model. Need at least ${MIN_TOTAL_SAMPLES} resolved leads and ${MIN_PER_CLASS} examples in each outcome class.`,
        available: { total: examples.length, won: positiveSamples, notWon: negativeSamples },
      });
    }

    const { train, test } = splitTrainingExamples(examples);
    const fitted = trainLogisticRegression(train);
    const metrics = evaluateModel(fitted, test);
    metrics.trainSamples = train.length;

    const saved = await prisma.leadScoringModel.upsert({
      where: { companyId },
      create: {
        companyId,
        version: 1,
        weights: fitted.weights,
        bias: fitted.bias,
        featureNames: [...LEAD_FEATURES],
        metrics,
        trainingSamples: examples.length,
        positiveSamples,
        negativeSamples,
      },
      update: {
        version: { increment: 1 },
        weights: fitted.weights,
        bias: fitted.bias,
        featureNames: [...LEAD_FEATURES],
        metrics,
        trainingSamples: examples.length,
        positiveSamples,
        negativeSamples,
        trainedAt: new Date(),
      },
    });

    return {
      trained: true,
      version: saved.version,
      trainedAt: saved.trainedAt,
      trainingSamples: saved.trainingSamples,
      positiveSamples: saved.positiveSamples,
      negativeSamples: saved.negativeSamples,
      metrics,
      featureNames: LEAD_FEATURES,
      evaluation: 'Stratified 80/20 holdout; terminal outcome status is the label and is excluded from model features.',
    };
  }

  async predict(companyId: string, leadId: string) {
    const [lead, modelRecord] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: leadId, companyId, deletedAt: null },
        select: { id: true, title: true, status: true, estimatedValue: true, priority: true, source: true, tags: true, assignedAgentId: true, contact: { select: { displayName: true } } },
      }),
      prisma.leadScoringModel.findUnique({ where: { companyId } }),
    ]);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!modelRecord) throw new BadRequestException('Lead intelligence model has not been trained for this company');
    const features = extractLeadFeatures(lead);
    const model: LogisticModel = { weights: modelRecord.weights as number[], bias: modelRecord.bias };
    const probability = predictProbability(model, features);
    return {
      leadId: lead.id,
      title: lead.title,
      contactName: lead.contact.displayName,
      conversionProbability: Math.round(probability * 100),
      intent: classifyIntent(probability),
      explanation: explainPrediction(model, features),
      modelVersion: modelRecord.version,
      trainedAt: modelRecord.trainedAt,
    };
  }

  async prioritized(companyId: string, limit = 50) {
    const modelRecord = await prisma.leadScoringModel.findUnique({ where: { companyId } });
    if (!modelRecord) throw new BadRequestException('Lead intelligence model has not been trained for this company');
    const leads = await prisma.lead.findMany({
      where: { companyId, deletedAt: null, status: { notIn: [...TERMINAL_STATUSES] } },
      select: { id: true, title: true, status: true, estimatedValue: true, priority: true, source: true, tags: true, assignedAgentId: true, createdAt: true, contact: { select: { displayName: true, phoneNumber: true } } },
      take: Math.max(1, Math.min(200, limit)),
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    const model: LogisticModel = { weights: modelRecord.weights as number[], bias: modelRecord.bias };
    const ranked: Array<{ conversionProbability: number; id: string; title: string; status: string; contact: { displayName: string | null; phoneNumber: string }; createdAt: Date; estimatedValue: number | null; intent: 'HIGH' | 'MEDIUM' | 'LOW'; explanation: ReturnType<typeof explainPrediction> }> = leads
      .map((lead: { id: string; title: string; status: string; estimatedValue: number | null; priority: string; source: string; tags: string[]; assignedAgentId: string | null; createdAt: Date; contact: { displayName: string | null; phoneNumber: string } }) => {
        const features = extractLeadFeatures(lead);
        const probability = predictProbability(model, features);
        return {
          id: lead.id,
          title: lead.title,
          status: lead.status,
          contact: lead.contact,
          createdAt: lead.createdAt,
          estimatedValue: lead.estimatedValue,
          conversionProbability: Math.round(probability * 100),
          intent: classifyIntent(probability),
          explanation: explainPrediction(model, features, 3),
        };
      });
    return ranked.sort((a, b) => b.conversionProbability - a.conversionProbability);
  }
}
