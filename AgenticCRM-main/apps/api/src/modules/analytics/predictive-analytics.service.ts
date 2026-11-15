import { Injectable } from '@nestjs/common';
import { prisma } from '@wacrm/database';

const MONTHS = 12;
const round = (n: number, d = 2) => Number(n.toFixed(d));
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => key;

function monthKeys(count: number, end = new Date()) {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - count + 1, 1));
  for (let i = 0; i < count; i++) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function linearForecast(values: number[], horizon = 3) {
  const n = values.length;
  if (!n) return { values: [], slope: 0, confidence: 'insufficient_data' as const, r2: null as number | null };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const denom = values.reduce((s, _, i) => s + (i - meanX) ** 2, 0);
  const slope = denom ? values.reduce((s, y, i) => s + (i - meanX) * (y - meanY), 0) / denom : 0;
  const intercept = meanY - slope * meanX;
  const predicted = values.map((_, i) => intercept + slope * i);
  const ssTot = values.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = values.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : null;
  const confidence = n < 4 ? 'low' : n < 8 || (r2 ?? 0) < 0.25 ? 'low' : (r2 ?? 0) >= 0.65 ? 'medium' : 'low';
  return { values: Array.from({ length: horizon }, (_, i) => Math.max(0, intercept + slope * (n + i))), slope, confidence, r2: r2 === null ? null : round(r2, 3) };
}

@Injectable()
export class PredictiveAnalyticsService {
  async getPredictiveOverview(companyId: string) {
    const keys = monthKeys(MONTHS);
    const start = new Date(`${keys[0]}-01T00:00:00.000Z`);
    const now = new Date();
    const [payments, leads, contacts, wonLineItems, products] = await Promise.all([
      prisma.payment.findMany({ where: { companyId, status: 'PAID', paidAt: { gte: start, lte: now } }, select: { paidAt: true, amount: true, refundedAmount: true, currency: true, contactId: true } }),
      prisma.lead.findMany({ where: { companyId, deletedAt: null, createdAt: { gte: start, lte: now } }, select: { createdAt: true, status: true } }),
      prisma.contact.findMany({ where: { companyId, deletedAt: null }, select: { id: true, displayName: true, firstName: true, lastName: true, phoneNumber: true, createdAt: true, lastSeenAt: true, score: true, lifecycleStage: true } }),
      prisma.dealLineItem.findMany({ where: { companyId, deal: { companyId, deletedAt: null, stage: 'WON' } }, select: { name: true, quantity: true, total: true, productId: true, deal: { select: { currency: true } } } }),
      prisma.product.findMany({ where: { companyId, isActive: true, archivedAt: null }, select: { id: true, name: true, price: true, currency: true, stock: true, reorderLevel: true, totalSold: true, category: true } }),
    ]);

    // Never add different currencies together. Forecast the currency with the largest observed net revenue.
    const currencyTotals = new Map<string, number>();
    for (const p of payments) currencyTotals.set(p.currency, (currencyTotals.get(p.currency) ?? 0) + Math.max(0, p.amount - p.refundedAmount));
    const currency = [...currencyTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INR';
    const monthly = new Map(keys.map(k => [k, 0]));
    const customerSpend = new Map<string, { spend: number; orders: number; lastPurchase: Date | null }>();
    for (const p of payments.filter(p => p.currency === currency && p.paidAt)) {
      const net = Math.max(0, p.amount - p.refundedAmount) / 100;
      const key = monthKey(p.paidAt!);
      if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + net);
      if (p.contactId) {
        const row = customerSpend.get(p.contactId) ?? { spend: 0, orders: 0, lastPurchase: null };
        row.spend += net; row.orders += 1;
        if (!row.lastPurchase || p.paidAt! > row.lastPurchase) row.lastPurchase = p.paidAt;
        customerSpend.set(p.contactId, row);
      }
    }
    const revenueValues = keys.map(k => round(monthly.get(k) ?? 0));
    const forecast = linearForecast(revenueValues);
    const forecastKeys = Array.from({ length: 3 }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 + i, 1))));
    const revenueForecast = forecastKeys.map((date, i) => ({ date, value: round(forecast.values[i] ?? 0) }));

    const monthlyLeads = new Map(keys.map(k => [k, { leads: 0, won: 0 }]));
    for (const lead of leads) {
      const row = monthlyLeads.get(monthKey(lead.createdAt));
      if (row) { row.leads += 1; if (lead.status === 'WON') row.won += 1; }
    }
    const conversionSeries = keys.map(date => {
      const row = monthlyLeads.get(date)!;
      return { date, leads: row.leads, won: row.won, conversionRate: row.leads ? round((row.won / row.leads) * 100, 1) : 0 };
    });
    const matureCohorts = conversionSeries.slice(0, -1).filter(r => r.leads > 0);
    const conversionForecast = matureCohorts.length
      ? round(matureCohorts.slice(-3).reduce((s, r) => s + r.conversionRate, 0) / Math.min(3, matureCohorts.length), 1)
      : 0;

    const spendValues = [...customerSpend.values()].map(v => v.spend).sort((a, b) => a - b);
    const spendThreshold = spendValues.length ? spendValues[Math.floor((spendValues.length - 1) * 0.8)] : 0;
    const today = now.getTime();
    const segments = { champions: 0, loyal: 0, atRisk: 0, newCustomers: 0, inactive: 0 };
    const segmentRows: Array<{ id: string; name: string; segment: string; spend: number; orders: number; lastPurchaseAt: string | null }> = [];
    for (const c of contacts) {
      const metrics = customerSpend.get(c.id);
      const last = metrics?.lastPurchase ?? null;
      const recencyDays = last ? Math.floor((today - last.getTime()) / 86400000) : null;
      let segment: 'champions' | 'loyal' | 'at_risk' | 'new_customers' | 'inactive' = 'inactive';
      if (metrics && recencyDays !== null && recencyDays <= 30 && metrics.spend >= spendThreshold && metrics.orders >= 2) segment = 'champions';
      else if (metrics && recencyDays !== null && recencyDays <= 60 && metrics.orders >= 2) segment = 'loyal';
      else if (metrics && recencyDays !== null && recencyDays > 90) segment = 'at_risk';
      else if (metrics && recencyDays !== null && recencyDays <= 30 && metrics.orders === 1) segment = 'new_customers';
      const segmentKey = segment === 'new_customers' ? 'newCustomers' : segment === 'at_risk' ? 'atRisk' : segment;
      segments[segmentKey]++;
      if (metrics) segmentRows.push({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.displayName || c.phoneNumber, segment, spend: round(metrics.spend), orders: metrics.orders, lastPurchaseAt: last?.toISOString() ?? null });
    }

    const productTotals = new Map<string, { name: string; units: number; revenue: number }>();
    for (const item of wonLineItems.filter(item => item.deal.currency === currency)) {
      const key = item.productId ?? item.name;
      const row = productTotals.get(key) ?? { name: item.name, units: 0, revenue: 0 };
      row.units += item.quantity; row.revenue += item.total;
      productTotals.set(key, row);
    }
    const productRecommendations = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((p, i) => ({ ...p, revenue: round(p.revenue), rank: i + 1, reason: 'Ranked by revenue from won deals in the available CRM records.' }));

    const avg = revenueValues.reduce((s, v) => s + v, 0) / Math.max(1, revenueValues.length);
    const variance = revenueValues.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(1, revenueValues.length);
    const sd = Math.sqrt(variance);
    const anomalies = revenueValues.map((value, i) => ({ date: keys[i], value, zScore: sd ? round((value - avg) / sd, 2) : 0 })).filter(r => Math.abs(r.zScore) >= 2).map(r => ({ ...r, direction: r.zScore > 0 ? 'above_expected' : 'below_expected', explanation: `Revenue was ${Math.abs(r.zScore)} standard deviations ${r.zScore > 0 ? 'above' : 'below'} the 12-month monthly average.` }));

    const insights: Array<{ type: string; title: string; detail: string; evidence: string }> = [];
    if (forecast.slope > 0) insights.push({ type: 'positive', title: 'Revenue trend is rising', detail: 'The fitted historical trend points upward; treat the projection as directional, not a guarantee.', evidence: `Estimated monthly trend: +${round(forecast.slope)} ${currency}/month.` });
    else if (forecast.slope < 0) insights.push({ type: 'warning', title: 'Revenue trend is declining', detail: 'Recent historical revenue has a downward fitted trend. Review pipeline coverage and payment delays.', evidence: `Estimated monthly trend: ${round(forecast.slope)} ${currency}/month.` });
    if (segments.atRisk > 0) insights.push({ type: 'warning', title: 'Customers may be slipping away', detail: 'These customers have prior paid activity but no purchase in more than 90 days.', evidence: `${segments.atRisk} customers classified as at risk.` });
    const lowStock = products.filter(p => p.stock <= p.reorderLevel);
    if (lowStock.length) insights.push({ type: 'action', title: 'Review products at or below reorder level', detail: 'Inventory counts are based on the current product catalogue.', evidence: `${lowStock.length} active products at or below their reorder threshold.` });
    if (!payments.length) insights.push({ type: 'info', title: 'Not enough payment history', detail: 'Record paid payments to enable revenue forecasts and anomaly detection.', evidence: 'No paid payments found in the last 12 months.' });

    return {
      generatedAt: now.toISOString(), currency, mixedCurrencies: currencyTotals.size > 1,
      dataCoverage: { months: payments.length ? keys.filter(k => (monthly.get(k) ?? 0) > 0).length : 0, paymentRecords: payments.length, leadRecords: leads.length, customers: contacts.length, wonLineItems: wonLineItems.length },
      revenue: { history: keys.map(date => ({ date: monthLabel(date), value: round(monthly.get(date) ?? 0) })), forecast: revenueForecast, confidence: forecast.confidence, rSquared: forecast.r2, method: 'Ordinary least-squares linear trend over monthly net paid revenue; negative predictions are floored at zero.' },
      salesTrends: keys.map(date => ({ date, leads: monthlyLeads.get(date)!.leads, won: monthlyLeads.get(date)!.won, revenue: round(monthly.get(date) ?? 0) })),
      conversion: { history: conversionSeries, nextPeriodRate: conversionForecast, method: 'Mean conversion rate of up to the last three completed monthly lead cohorts; not a causal model.' },
      customerSegmentation: { counts: segments, customers: segmentRows.sort((a, b) => b.spend - a.spend).slice(0, 30), definitions: { champions: 'Purchased within 30 days, at least two paid orders, and spend at or above the customer 80th-percentile threshold.', loyal: 'Purchased within 60 days with at least two paid orders.', atRisk: 'Has paid purchase history but last purchase was over 90 days ago.', newCustomers: 'Exactly one paid order within the last 30 days.', inactive: 'Does not match another segment, including contacts without recorded paid purchases.' } },
      productRecommendations, anomalies, insights,
    };
  }
}
