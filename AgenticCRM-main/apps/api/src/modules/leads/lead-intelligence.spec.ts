declare const describe: (name: string, suite: () => void) => void;
declare const it: (name: string, test: () => void) => void;
declare const expect: (value: unknown) => any;

import {
  classifyIntent,
  evaluateModel,
  extractLeadFeatures,
  LEAD_FEATURES,
  predictProbability,
  splitTrainingExamples,
  trainLogisticRegression,
  type TrainingExample,
} from './lead-intelligence';

describe('lead intelligence model', () => {
  it('encodes existing CRM attributes into a fixed, ordered feature vector', () => {
    const features = extractLeadFeatures({
      estimatedValue: 250000,
      priority: 'URGENT',
      source: 'WHATSAPP',
      tags: ['high-intent'],
      assignedAgentId: 'agent-1',
    });

    expect(features).toHaveLength(LEAD_FEATURES.length);
    expect(features[LEAD_FEATURES.indexOf('source_whatsapp')]).toBe(1);
    expect(features[LEAD_FEATURES.indexOf('tag_high_intent')]).toBe(1);
    expect(features[LEAD_FEATURES.indexOf('has_assignee')]).toBe(1);
  });

  it('creates a deterministic stratified holdout containing both outcome classes', () => {
    const examples: TrainingExample[] = Array.from({ length: 30 }, (_, index) => ({
      id: `example-${index}`,
      features: [index / 30],
      label: index < 15 ? 1 : 0,
    }));
    const first = splitTrainingExamples(examples);
    const second = splitTrainingExamples(examples);

    expect(first).toEqual(second);
    expect(first.test.some((row) => row.label === 1)).toBe(true);
    expect(first.test.some((row) => row.label === 0)).toBe(true);
    expect(first.train.length + first.test.length).toBe(examples.length);
  });

  it('learns a useful probability ordering and reports held-out metrics', () => {
    const examples: TrainingExample[] = Array.from({ length: 100 }, (_, index) => ({
      id: `row-${index}`,
      features: [index < 50 ? 1 : 0, index < 50 ? 0 : 1],
      label: index < 50 ? 1 : 0,
    }));
    const { train, test } = splitTrainingExamples(examples);
    const model = trainLogisticRegression(train);
    const positiveProbability = predictProbability(model, [1, 0]);
    const negativeProbability = predictProbability(model, [0, 1]);
    const metrics = evaluateModel(model, test);

    expect(positiveProbability).toBeGreaterThan(negativeProbability);
    expect(metrics.auc).toBeGreaterThan(0.9);
    expect(metrics.testSamples).toBe(test.length);
  });

  it('maps predicted conversion probability to the requested intent bands', () => {
    expect(classifyIntent(0.8)).toBe('HIGH');
    expect(classifyIntent(0.55)).toBe('MEDIUM');
    expect(classifyIntent(0.2)).toBe('LOW');
  });
});
