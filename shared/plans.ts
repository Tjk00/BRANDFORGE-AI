/**
 * Subscription architecture.
 *
 * Billing is intentionally NOT activated: no payment provider is called, no
 * trial starts and no card is required. Plans are enforced as project limits so
 * the product is honest about what each tier allows, and a checkout endpoint can
 * be switched on later once a provider key is configured by an administrator.
 */

export type PlanId = 'free' | 'pro' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  projectLimit: number;
  summary: string;
  features: string[];
  billingEnabled: false;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    projectLimit: 3,
    summary: 'Everything you need to build one brand properly.',
    features: [
      '3 saved brand projects',
      'Niche research and audience analysis',
      '50–100 generated names per run',
      '10-platform handle checks',
      'Logos, avatars and banners (SVG + PNG)',
      'Brand voice and SEO copy',
      'Complete brand kit ZIP',
    ],
    billingEnabled: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '$0',
    cadence: 'preview tier',
    projectLimit: 25,
    summary: 'For creators running several channels at once.',
    features: [
      '25 saved brand projects',
      'Everything in Free',
      'Extended research notes per project',
      'Full logo variation set',
      'Priority export bundle',
    ],
    billingEnabled: false,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: '$0',
    cadence: 'preview tier',
    projectLimit: 100,
    summary: 'For studios and teams managing a portfolio of brands.',
    features: [
      '100 saved brand projects',
      'Everything in Pro',
      'Multiple brand workspaces',
      'Team-ready project structure',
      'Administrator-managed provider keys',
    ],
    billingEnabled: false,
  },
};

export const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value);
}

export function getPlan(value: unknown): Plan {
  return PLANS[isPlanId(value) ? value : 'free'];
}

export function planList(): Plan[] {
  return PLAN_IDS.map((id) => PLANS[id]);
}
