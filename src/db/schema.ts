import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(), // coo | researcher | pm | builder | growth | sales | kaizen
  codename: text('codename').notNull(),
  title: text('title').notNull(),
  department: text('department').notNull(),
  modelId: text('model_id').notNull().default('gemini-4-hydrogen'),
  thinkingLevel: text('thinking_level').notNull().default('high'), // low | medium | high | xhigh
  dailyBudgetUsd: real('daily_budget_usd').notNull().default(1.5),
  playbookVersion: integer('playbook_version').notNull().default(1),
  status: text('status').notNull().default('idle'), // idle | running | error
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  lastActiveAt: text('last_active_at'),
});

export const agentPlaybooks = sqliteTable('agent_playbooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: text('agent_id').notNull(),
  version: integer('version').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  winningPatternsJson: text('winning_patterns_json').notNull().default('[]'),
  avoidPatternsJson: text('avoid_patterns_json').notNull().default('[]'),
  kaizenReason: text('kaizen_reason').notNull(),
  createdAt: text('created_at').notNull(),
});

export const autonomyPolicies = sqliteTable('autonomy_policies', {
  gateKey: text('gate_key').primaryKey(), // OUTBOUND_MESSAGE | PRODUCTION_RELEASE | PRICING_UPDATE | BUDGET_SPEND
  label: text('label').notNull(),
  description: text('description').notNull(),
  mode: text('mode').notNull().default('REQUIRE_APPROVAL'), // REQUIRE_APPROVAL | FULL_AUTO
  dailyCap: integer('daily_cap').notNull().default(25),
  updatedAt: text('updated_at').notNull(),
});

export const shiftRuns = sqliteTable('shift_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftType: text('shift_type').notNull(), // morning | midday | afternoon | night
  shiftDate: text('shift_date').notNull(), // YYYY-MM-DD (Europe/Istanbul)
  triggerSource: text('trigger_source').notNull(), // cron | catchup | cockpit | whatsapp | antigravity
  status: text('status').notNull(), // running | completed | failed
  summary: text('summary').notNull().default(''),
  metricsJson: text('metrics_json').notNull().default('{}'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

export const agentTasks = sqliteTable('agent_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftRunId: integer('shift_run_id'),
  agentId: text('agent_id').notNull(),
  title: text('title').notNull(),
  executionMode: text('execution_mode').notNull().default('antigravity_native'), // antigravity_native | gemini_api
  modelUsed: text('model_used').notNull(),
  tokensUsed: integer('tokens_used').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
  status: text('status').notNull(), // completed | failed
  outputSummary: text('output_summary').notNull(),
  artifactPath: text('artifact_path'),
  createdAt: text('created_at').notNull(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  targetSectorsJson: text('target_sectors_json').notNull().default('[]'),
  starterPriceTry: integer('starter_price_try').notNull(),
  proPriceTry: integer('pro_price_try').notNull(),
  enterpriseSetupTry: integer('enterprise_setup_try').notNull(),
  featuresJson: text('features_json').notNull().default('[]'),
  status: text('status').notNull().default('live'), // live | building | draft
  mrrTry: integer('mrr_try').notNull().default(0),
  activeCustomers: integer('active_customers').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  businessName: text('business_name').notNull(),
  slug: text('slug').notNull().unique(),
  sector: text('sector').notNull(), // dental | beauty | realestate | restaurant | office
  city: text('city').notNull(),
  district: text('district').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  instagramHandle: text('instagram_handle').notNull(),
  painPoint: text('pain_point').notNull(),
  leadScore: integer('lead_score').notNull(),
  stage: text('stage').notNull().default('DISCOVERED'), // DISCOVERED | DEMO_READY | AWAITING_APPROVAL | CONTACTED | HOT_ENGAGED | WON
  createdAt: text('created_at').notNull(),
});

export const customDemos = sqliteTable('custom_demos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  leadId: integer('lead_id').notNull(),
  productSlug: text('product_slug').notNull(),
  slug: text('slug').notNull().unique(),
  headline: text('headline').notNull(),
  subheadline: text('subheadline').notNull(),
  sector: text('sector').notNull(),
  city: text('city').notNull(),
  accentColor: text('accent_color').notNull(),
  assistantName: text('assistant_name').notNull(),
  welcomeMessage: text('welcome_message').notNull(),
  servicesJson: text('services_json').notNull().default('[]'),
  faqJson: text('faq_json').notNull().default('[]'),
  viewsCount: integer('views_count').notNull().default(0),
  chatsCount: integer('chats_count').notNull().default(0),
  appointmentsBookedCount: integer('appointments_booked_count').notNull().default(0),
  checkoutClicksCount: integer('checkout_clicks_count').notNull().default(0),
  lastInteractedAt: text('last_interacted_at'),
  createdAt: text('created_at').notNull(),
});

export const outreachMessages = sqliteTable('outreach_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  leadId: integer('lead_id').notNull(),
  demoSlug: text('demo_slug').notNull(),
  channel: text('channel').notNull(), // whatsapp | email | instagram
  variant: text('variant').notNull(), // A | B
  hookStyle: text('hook_style').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status').notNull().default('PENDING_APPROVAL'), // DRAFT | PENDING_APPROVAL | SENT | REPLIED | CONVERTED
  createdAt: text('created_at').notNull(),
  sentAt: text('sent_at'),
});

export const approvalQueue = sqliteTable('approval_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  gateKey: text('gate_key').notNull(),
  agentId: text('agent_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | AUTO_EXECUTED
  decidedBy: text('decided_by'),
  createdAt: text('created_at').notNull(),
  decidedAt: text('decided_at'),
});

export const contentPosts = sqliteTable('content_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  sector: text('sector').notNull(),
  targetKeyword: text('target_keyword').notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  socialHook: text('social_hook').notNull(),
  viewsCount: integer('views_count').notNull().default(0),
  status: text('status').notNull().default('PUBLISHED'),
  createdAt: text('created_at').notNull(),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(),
  leadId: integer('lead_id'),
  businessName: text('business_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  productSlug: text('product_slug').notNull(),
  planTier: text('plan_tier').notNull(), // starter | pro | enterprise_b2b
  amountTry: integer('amount_try').notNull(),
  paymentProvider: text('payment_provider').notNull(), // paytr | iyzico | shopier | b2b_invoice
  status: text('status').notNull().default('TRIAL_ACTIVE'), // PENDING_PAYMENT | PAID | TRIAL_ACTIVE
  createdAt: text('created_at').notNull(),
});

export const kaizenLogs = sqliteTable('kaizen_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftRunId: integer('shift_run_id'),
  evaluatedDate: text('evaluated_date').notNull(),
  winningVariant: text('winning_variant').notNull(),
  topSector: text('top_sector').notNull(),
  conversionRatePct: real('conversion_rate_pct').notNull(),
  insightsSummary: text('insights_summary').notNull(),
  upgradedAgentsJson: text('upgraded_agents_json').notNull().default('[]'),
  newBuildSpecPath: text('new_build_spec_path'),
  createdAt: text('created_at').notNull(),
});

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
