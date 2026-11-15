/**
 * Tenant-local lead conversion model.
 *
 * A small, dependency-free logistic-regression implementation is used so the
 * API can train and serve predictions without introducing a Python runtime or
 * an external ML service. Only stable, pre-outcome CRM fields are features;
 * terminal lead status is used solely as the training label.
 */
export const LEAD_FEATURES = [
  'estimated_value',
  'priority_low',
  'priority_high',
  'priority_urgent',
  'source_whatsapp',
  'source_website',
  'source_referral',
  'source_inbound_email',
  'source_outbound',
  'source_campaign',
  'source_form',
  'source_import',
  'source_ai_chat',
  'source_meta_ads',
  'source_webhook',
  'source_other',
  'tag_high_intent',
  'tag_cold',
  'has_assignee',
  'tag_count',
] as const;

export type LeadFeatureName = (typeof LEAD_FEATURES)[number];

export interface LeadFeatureInput {
  estimatedValue: number | null;
  priority: string;
  source: string;
  tags: string[];
  assignedAgentId: string | null;
}

export interface TrainingExample {
  id: string;
  features: number[];
  label: 0 | 1;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  threshold: number;
  trainSamples: number;
  testSamples: number;
}

export interface LogisticModel {
  weights: number[];
  bias: number;
}

export interface LeadExplanation {
  feature: string;
  label: string;
  contribution: number;
  direction: 'positive' | 'negative';
}

const FEATURE_LABELS: Record<LeadFeatureName, string> = {
  estimated_value: 'Estimated deal value',
  priority_low: 'Low priority',
  priority_high: 'High priority',
  priority_urgent: 'Urgent priority',
  source_whatsapp: 'WhatsApp source',
  source_website: 'Website source',
  source_referral: 'Referral source',
  source_inbound_email: 'Inbound email source',
  source_outbound: 'Outbound source',
  source_campaign: 'Campaign source',
  source_form: 'Form source',
  source_import: 'Imported lead',
  source_ai_chat: 'AI chat source',
  source_meta_ads: 'Meta Ads source',
  source_webhook: 'Webhook source',
  source_other: 'Other source',
  tag_high_intent: 'High-intent tag',
  tag_cold: 'Cold tag',
  has_assignee: 'Assigned to an agent',
  tag_count: 'Number of lead tags',
};

export function extractLeadFeatures(input: LeadFeatureInput): number[] {
  const source = input.source.toUpperCase();
  const tags = input.tags.map((tag) => tag.toLowerCase());
  const sourceFeature: Record<string, LeadFeatureName> = {
    WHATSAPP: 'source_whatsapp', WEBSITE: 'source_website', REFERRAL: 'source_referral',
    INBOUND_EMAIL: 'source_inbound_email', OUTBOUND: 'source_outbound', CAMPAIGN: 'source_campaign',
    FORM: 'source_form', IMPORT: 'source_import', AI_CHAT: 'source_ai_chat',
    META_ADS: 'source_meta_ads', WEBHOOK: 'source_webhook', OTHER: 'source_other',
  };
  const activeSource = sourceFeature[source] ?? 'source_other';
  const values: Record<LeadFeatureName, number> = {
    estimated_value: Math.min(Math.log1p(Math.max(0, input.estimatedValue ?? 0)) / Math.log1p(1_000_000), 1),
    priority_low: input.priority === 'LOW' ? 1 : 0,
    priority_high: input.priority === 'HIGH' ? 1 : 0,
    priority_urgent: input.priority === 'URGENT' ? 1 : 0,
    source_whatsapp: 0, source_website: 0, source_referral: 0, source_inbound_email: 0,
    source_outbound: 0, source_campaign: 0, source_form: 0, source_import: 0,
    source_ai_chat: 0, source_meta_ads: 0, source_webhook: 0, source_other: 0,
    tag_high_intent: tags.includes('high-intent') ? 1 : 0,
    tag_cold: tags.includes('cold') ? 1 : 0,
    has_assignee: input.assignedAgentId ? 1 : 0,
    tag_count: Math.min(input.tags.length / 10, 1),
  };
  values[activeSource] = 1;
  return LEAD_FEATURES.map((name) => values[name]);
}

function sigmoid(value: number): number {
  const bounded = Math.max(-30, Math.min(30, value));
  return 1 / (1 + Math.exp(-bounded));
}

export function predictProbability(model: LogisticModel, features: number[]): number {
  const logit = model.bias + model.weights.reduce((sum, weight, index) => sum + weight * (features[index] ?? 0), 0);
  return sigmoid(logit);
}

/** Deterministic, stratified 80/20 split so training and evaluation are repeatable. */
export function splitTrainingExamples(examples: TrainingExample[]): { train: TrainingExample[]; test: TrainingExample[] } {
  const stableHash = (value: string) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
  const byStableHash = (a: TrainingExample, b: TrainingExample) => stableHash(a.id) - stableHash(b.id);
  const positives = examples.filter((example) => example.label === 1).sort(byStableHash);
  const negatives = examples.filter((example) => example.label === 0).sort(byStableHash);
  const holdout = (rows: TrainingExample[]) => Math.max(1, Math.floor(rows.length * 0.2));
  const positiveTestCount = holdout(positives);
  const negativeTestCount = holdout(negatives);
  return {
    test: [...positives.slice(0, positiveTestCount), ...negatives.slice(0, negativeTestCount)],
    train: [...positives.slice(positiveTestCount), ...negatives.slice(negativeTestCount)],
  };
}

export function trainLogisticRegression(examples: TrainingExample[], iterations = 1800, learningRate = 0.08): LogisticModel {
  if (!examples.length) throw new Error('At least one training example is required');
  const weights = new Array(LEAD_FEATURES.length).fill(0);
  let bias = 0;
  const regularization = 0.015;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const gradients = new Array(weights.length).fill(0);
    let biasGradient = 0;
    for (const example of examples) {
      const error = predictProbability({ weights, bias }, example.features) - example.label;
      biasGradient += error;
      for (let index = 0; index < weights.length; index++) {
        gradients[index] += error * (example.features[index] ?? 0);
      }
    }
    const scale = 1 / examples.length;
    bias -= learningRate * biasGradient * scale;
    for (let index = 0; index < weights.length; index++) {
      weights[index] -= learningRate * (gradients[index] * scale + regularization * weights[index]);
    }
  }
  return { weights, bias };
}

export function evaluateModel(model: LogisticModel, examples: TrainingExample[]): ModelMetrics {
  const threshold = 0.5;
  let tp = 0; let tn = 0; let fp = 0; let fn = 0;
  const scored = examples.map((example) => ({ label: example.label, probability: predictProbability(model, example.features) }));
  for (const item of scored) {
    const predicted = item.probability >= threshold ? 1 : 0;
    if (predicted === 1 && item.label === 1) tp++;
    else if (predicted === 0 && item.label === 0) tn++;
    else if (predicted === 1) fp++;
    else fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const auc = areaUnderRoc(scored);
  return {
    accuracy: scored.length ? (tp + tn) / scored.length : 0,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    auc,
    threshold,
    trainSamples: 0,
    testSamples: examples.length,
  };
}

function areaUnderRoc(rows: Array<{ label: 0 | 1; probability: number }>): number {
  const positives = rows.filter((row) => row.label === 1);
  const negatives = rows.filter((row) => row.label === 0);
  if (!positives.length || !negatives.length) return 0;
  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.probability > negative.probability) wins++;
      else if (positive.probability === negative.probability) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

export function explainPrediction(model: LogisticModel, features: number[], limit = 5): LeadExplanation[] {
  return LEAD_FEATURES.map((feature, index) => {
    const contribution = model.weights[index] * (features[index] ?? 0);
    return {
      feature,
      label: FEATURE_LABELS[feature],
      contribution: Number(contribution.toFixed(4)),
      direction: (contribution >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
    };
  })
    .filter((item) => Math.abs(item.contribution) > 0.0001)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}

export function classifyIntent(probability: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (probability >= 0.7) return 'HIGH';
  if (probability >= 0.4) return 'MEDIUM';
  return 'LOW';
}
