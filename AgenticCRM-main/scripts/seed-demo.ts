import { prisma } from '@wacrm/database';

/**
 * Safe, repeatable demo data loader. It only writes into an explicitly selected
 * existing company and never deletes or overwrites customer records.
 */
async function main() {
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('Refusing to seed demo data: set DEMO_MODE=true explicitly.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed fictional demo records in production.');
  }
  const slug = process.env.DEMO_COMPANY_SLUG;
  if (!slug || !/demo/i.test(slug)) {
    throw new Error('DEMO_COMPANY_SLUG must identify a dedicated demo tenant (slug must contain demo).');
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) throw new Error(`Company "${slug}" does not exist. Create/select a dedicated demo tenant first.`);

  const people = [
    { phoneNumber: '919900000101', firstName: 'Aarav', lastName: 'Mehta', email: 'aarav.mehta@example.invalid', companyName: 'Northstar Retail', jobTitle: 'Operations Head' },
    { phoneNumber: '919900000102', firstName: 'Diya', lastName: 'Sharma', email: 'diya.sharma@example.invalid', companyName: 'BluePeak Foods', jobTitle: 'Founder' },
    { phoneNumber: '919900000103', firstName: 'Kabir', lastName: 'Sen', email: 'kabir.sen@example.invalid', companyName: 'UrbanNest', jobTitle: 'Purchase Manager' },
    { phoneNumber: '919900000104', firstName: 'Mira', lastName: 'Roy', email: 'mira.roy@example.invalid', companyName: 'GreenCart', jobTitle: 'Marketing Lead' },
    { phoneNumber: '919900000105', firstName: 'Ishaan', lastName: 'Das', email: 'ishaan.das@example.invalid', companyName: 'PixelCraft', jobTitle: 'Director' },
  ];

  const contacts = [];
  for (const person of people) {
    const contact = await prisma.contact.upsert({
      where: { companyId_phoneNumber: { companyId: company.id, phoneNumber: person.phoneNumber } },
      update: {},
      create: { companyId: company.id, ...person, displayName: `${person.firstName} ${person.lastName}`, tags: ['demo', 'competition-demo'], notes: 'Fictional demo persona. Not a real customer.' },
    });
    contacts.push(contact);
  }

  const leadSpecs = [
    { title: 'Retail inventory automation enquiry', status: 'QUALIFIED', source: 'WEBSITE', priority: 'HIGH', estimatedValue: 185000, probability: 70 },
    { title: 'Restaurant growth platform enquiry', status: 'PROPOSAL_SENT', source: 'REFERRAL', priority: 'URGENT', estimatedValue: 245000, probability: 80 },
    { title: 'Storefront and CRM evaluation', status: 'CONTACTED', source: 'WHATSAPP', priority: 'MEDIUM', estimatedValue: 96000, probability: 45 },
    { title: 'Marketing automation enquiry', status: 'NEW', source: 'CAMPAIGN', priority: 'MEDIUM', estimatedValue: 72000, probability: 25 },
    { title: 'Enterprise CRM pilot', status: 'NEGOTIATING', source: 'MANUAL', priority: 'HIGH', estimatedValue: 390000, probability: 85 },
  ] as const;

  const leads = [];
  for (let i = 0; i < leadSpecs.length; i++) {
    const spec = leadSpecs[i];
    let lead = await prisma.lead.findFirst({ where: { companyId: company.id, contactId: contacts[i].id, title: spec.title } });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { companyId: company.id, contactId: contacts[i].id, ...spec, score: [82, 91, 64, 42, 88][i], currency: 'INR', tags: ['demo'], notes: 'Fictional competition demo record.' },
      });
    }
    leads.push(lead);
  }

  const productSpecs = [
    { sku: 'DEMO-CRM-001', name: 'BizPilot Growth CRM', category: 'Software', price: 18500000, stock: 120 },
    { sku: 'DEMO-AUTO-002', name: 'Workflow Automation Pack', category: 'Automation', price: 24500000, stock: 80 },
    { sku: 'DEMO-STORE-003', name: 'Digital Storefront Starter', category: 'Commerce', price: 39000000, stock: 45 },
  ];
  const products = [];
  for (const spec of productSpecs) {
    products.push(await prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: spec.sku } },
      update: {},
      create: { companyId: company.id, ...spec, currency: 'INR', trackInventory: true, reorderLevel: 10, tags: ['demo'], description: 'Fictional product for the BizPilot competition walkthrough.' },
    }));
  }

  const dealSpecs = [
    { title: 'Northstar Retail — Growth CRM rollout', stage: 'PROPOSAL', value: 185000, probability: 70 },
    { title: 'BluePeak Foods — Automation deployment', stage: 'NEGOTIATION', value: 245000, probability: 80 },
    { title: 'PixelCraft — Enterprise pilot', stage: 'QUALIFIED', value: 390000, probability: 85 },
  ] as const;
  for (const spec of dealSpecs) {
    const contactIndex = spec.title.startsWith('Northstar') ? 0 : spec.title.startsWith('BluePeak') ? 1 : 4;
    const lead = leads[contactIndex];
    const existingDeal = await prisma.deal.findFirst({ where: { companyId: company.id, title: spec.title } });
    if (!existingDeal) {
      await prisma.deal.create({
        data: {
          companyId: company.id, contactId: contacts[contactIndex].id, leadId: lead.id, ...spec,
          source: 'MANUAL', currency: 'INR', weightedValue: spec.value * spec.probability / 100,
          tags: ['demo'], notes: 'Fictional demo opportunity.',
          lineItems: { create: {
            companyId: company.id, productId: products[contactIndex === 0 ? 0 : contactIndex === 1 ? 1 : 2].id,
            name: products[contactIndex === 0 ? 0 : contactIndex === 1 ? 1 : 2].name,
            quantity: 1, unitPrice: spec.value, total: spec.value,
          } },
        },
      });
    }
  }

  const taskSpecs = [
    { title: 'Call Northstar Retail decision maker', status: 'TODO', priority: 'HIGH', leadId: leads[0].id, contactId: contacts[0].id },
    { title: 'Send BluePeak Foods proposal walkthrough', status: 'IN_PROGRESS', priority: 'URGENT', leadId: leads[1].id, contactId: contacts[1].id },
    { title: 'Prepare Enterprise pilot scope', status: 'TODO', priority: 'MEDIUM', leadId: leads[4].id, contactId: contacts[4].id },
  ] as const;
  for (const spec of taskSpecs) {
    const exists = await prisma.task.findFirst({ where: { companyId: company.id, title: spec.title } });
    if (!exists) await prisma.task.create({ data: { companyId: company.id, ...spec, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  }

  console.log(JSON.stringify({
    status: 'seeded', company: company.name,
    counts: { contacts: contacts.length, leads: leads.length, products: products.length, deals: dealSpecs.length, tasks: taskSpecs.length },
    note: 'All records are fictional, tagged demo, and use example.invalid emails.',
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
