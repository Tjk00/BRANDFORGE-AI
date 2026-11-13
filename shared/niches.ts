import type { Niche, NicheResearchLink, PlatformId } from './types';

/**
 * A curated starting library for niche discovery.
 * These are editorial research briefs, not live market metrics: every entry ships
 * real search links so demand can be checked against the source before committing.
 */
export const NICHES: Niche[] = [
  {
    id: 'ai-productivity',
    label: 'AI & Productivity Systems',
    category: 'Technology',
    summary:
      'Workflow builders who teach practical AI use for freelancers and small teams: prompts, automations, and tool stacks that save hours every week.',
    audience: ['Freelancers', 'Solo founders', 'Ops managers', 'Agency owners'],
    demand: 'very high',
    demandNote:
      'Search interest keeps climbing as new models ship, but the space is crowded, so specific workflows beat general AI commentary.',
    monetization: ['Template packs', 'Cohort workshops', 'Tool affiliate deals', 'Paid newsletter'],
    contentAngles: [
      'One automation rebuilt end to end each week',
      'Before/after time-saved teardowns of real client work',
      'Honest tool comparisons with cost per task',
      'Beginner mistakes that quietly break AI workflows',
    ],
    competitorLandscape:
      'Dominated by large tech channels and a long tail of tool reviewers. Differentiation comes from a named workflow system and documented results.',
    keywords: ['ai workflow', 'automation', 'prompt library', 'productivity system', 'ai tools'],
    platforms: ['youtube', 'linkedin', 'x', 'tiktok'],
  },
  {
    id: 'home-fitness',
    label: 'Home Fitness for Busy Adults',
    category: 'Health',
    summary:
      'Short, equipment-light training for people with 20 minutes and no gym membership, with an emphasis on sustainable habits rather than transformations.',
    audience: ['Parents', 'Desk workers', 'Beginners over 30', 'Shift workers'],
    demand: 'very high',
    demandNote: 'January and Monday spikes are consistent; retention depends on realistic programming.',
    monetization: ['Program subscriptions', 'Equipment affiliate', 'Form-check coaching', 'Meal plan downloads'],
    contentAngles: [
      'Follow-along sessions that fit a lunch break',
      'Form fixes for the five most common home exercises',
      'Progression ladders using one pair of dumbbells',
      'What to do when motivation drops for a week',
    ],
    competitorLandscape:
      'Huge established channels dominate generic workouts; niche entry points like "postpartum" or "night shift" convert better.',
    keywords: ['home workout', 'no equipment training', 'beginner strength', 'short workouts', 'habit building'],
    platforms: ['youtube', 'instagram', 'tiktok', 'pinterest'],
  },
  {
    id: 'personal-finance',
    label: 'Personal Finance for Beginners',
    category: 'Finance',
    summary:
      'Plain-language money education: budgeting systems, debt payoff order, first investing steps, and the behavioural side of spending.',
    audience: ['First-job earners', 'Students', 'Young families', 'Debt payers'],
    demand: 'high',
    demandNote:
      'Evergreen demand with strong search volume; YMYL topics need sourcing and care to build trust.',
    monetization: ['Budget template sales', 'Course', 'Sponsorships', 'Newsletter'],
    contentAngles: [
      'Full budget walkthrough with real numbers',
      'Debt payoff order explained with one example',
      'What a first index-fund purchase actually looks like',
      'Hidden subscription audits',
    ],
    competitorLandscape:
      'Trust-driven and saturated at the top. Regional or life-stage focus (nurses, apprentices, single parents) is the realistic opening.',
    keywords: ['budget template', 'debt payoff', 'first investment', 'money basics', 'saving system'],
    platforms: ['youtube', 'instagram', 'tiktok', 'pinterest', 'linkedin'],
  },
  {
    id: 'faceless-youtube',
    label: 'Faceless YouTube Production',
    category: 'Creator Economy',
    summary:
      'Systems for building narrative channels without appearing on camera: scripting, stock sourcing, voice workflow, and packaging.',
    audience: ['Aspiring creators', 'Side hustlers', 'Editors', 'VO artists'],
    demand: 'growing',
    demandNote:
      'Interest tracks YouTube monetisation policy changes; audiences want repeatable production systems, not channel showcases.',
    monetization: ['Production templates', 'Editing services', 'Stock asset bundles', 'Community'],
    contentAngles: [
      'A full video built from blank page to upload',
      'Retention graphs explained shot by shot',
      'Script structures for documentary style',
      'Realistic cost breakdown per video',
    ],
    competitorLandscape:
      'Many "make money faceless" channels overpromise; a craft-first, numbers-honest angle stands out.',
    keywords: ['faceless channel', 'video scripting', 'retention editing', 'stock footage workflow', 'youtube growth'],
    platforms: ['youtube', 'tiktok', 'x', 'reddit'],
  },
  {
    id: 'eco-living',
    label: 'Practical Eco Living',
    category: 'Lifestyle',
    summary:
      'Low-waste habits that save money, aimed at renters who cannot retrofit a house or afford premium sustainable brands.',
    audience: ['Renters', 'Young families', 'Students', 'Budget households'],
    demand: 'steady',
    demandNote: 'Steady interest with seasonal peaks around spring cleaning and back-to-school.',
    monetization: ['Refill affiliate', 'Digital guides', 'Brand partnerships', 'Workshops'],
    contentAngles: [
      'Cost comparison: reusable vs disposable over a year',
      'Zero-waste kitchen swap that costs under a set budget',
      'Renter-friendly energy savings',
      'Debunking expensive green products',
    ],
    competitorLandscape:
      'Aesthetic-led channels dominate; a budget-first, renter-first voice is underserved.',
    keywords: ['low waste', 'sustainable living', 'refill shop', 'eco budget', 'green swaps'],
    platforms: ['instagram', 'pinterest', 'youtube', 'tiktok'],
  },
  {
    id: 'pet-care',
    label: 'Dog Training & Pet Care',
    category: 'Pets',
    summary:
      'Force-free training for first-time dog owners, covering crate training, recall, leash skills, and settling alone.',
    audience: ['First-time owners', 'Rescue adopters', 'Apartment dwellers', 'Puppy parents'],
    demand: 'high',
    demandNote:
      'Consistent evergreen search demand; credentials and welfare-first framing build trust fast.',
    monetization: ['Training courses', '1:1 consults', 'Gear affiliate', 'Membership'],
    contentAngles: [
      'One skill trained in a single session',
      'Common advice that makes separation anxiety worse',
      'Apartment-friendly enrichment games',
      'Rescue decompression: the first two weeks',
    ],
    competitorLandscape:
      'Strong established trainers with TV reach; breed-specific or apartment-specific niches remain open.',
    keywords: ['puppy training', 'dog recall', 'separation anxiety', 'positive reinforcement', 'enrichment'],
    platforms: ['youtube', 'tiktok', 'instagram', 'pinterest'],
  },
  {
    id: 'home-coffee',
    label: 'Home Coffee Craft',
    category: 'Food & Drink',
    summary:
      'Gear-light coffee improvement: grinders, water, ratios, and repeatable recipes for people who will never open a cafe.',
    audience: ['Home baristas', 'Remote workers', 'Gift buyers', 'Budget upgraders'],
    demand: 'growing',
    demandNote: 'Grows with equipment price drops; strong affiliate economics.',
    monetization: ['Gear affiliate', 'Bean subscriptions', 'Recipe cards', 'Workshops'],
    contentAngles: [
      'Same beans, three grinders, blind taste test',
      'Cheapest upgrade that changes the cup',
      'Water recipe explained without chemistry jargon',
      'Espresso troubleshooting by taste',
    ],
    competitorLandscape:
      'Technical channels set the bar; beginner-friendly, budget-capped advice converts well.',
    keywords: ['pour over recipe', 'coffee grinder', 'espresso basics', 'water for coffee', 'budget setup'],
    platforms: ['youtube', 'instagram', 'pinterest', 'tiktok'],
  },
  {
    id: 'digital-templates',
    label: 'Digital Templates & Planners',
    category: 'Creator Economy',
    summary:
      'Notion, spreadsheet, and printable systems that solve one scheduling or planning problem for a specific job.',
    audience: ['Small business owners', 'Students', 'Teachers', 'Creators'],
    demand: 'high',
    demandNote: 'Marketplace search traffic is reliable; differentiation comes from specificity.',
    monetization: ['Template sales', 'Bundle upsells', 'Custom builds', 'Affiliate'],
    contentAngles: [
      'Build the template on camera in real time',
      'Before/after of a messy workflow',
      'Free lite version to paid bundle path',
      'How to adapt the template for a different job',
    ],
    competitorLandscape:
      'Thousands of generic planners; occupation-specific templates with real examples win.',
    keywords: ['notion template', 'planner printable', 'spreadsheet tracker', 'workflow system', 'digital download'],
    platforms: ['pinterest', 'instagram', 'tiktok', 'youtube'],
  },
  {
    id: 'career-upskilling',
    label: 'Career Change & Upskilling',
    category: 'Education',
    summary:
      'Structured roadmaps for adults moving into a new field, with portfolio proof and interview preparation instead of vague motivation.',
    audience: ['Career switchers', 'Returning parents', 'Graduates', 'Mid-career professionals'],
    demand: 'high',
    demandNote: 'Counter-cyclical: interest rises when hiring slows.',
    monetization: ['Cohort course', 'Portfolio reviews', 'Resume teardowns', 'Employer partnerships'],
    contentAngles: [
      '90-day roadmap with weekly checkpoints',
      'Portfolio project that gets replies',
      'Salary negotiation scripts that worked',
      'What hiring managers actually screen for',
    ],
    competitorLandscape:
      'Recruiter-led channels own attention; field-specific roadmaps with evidence of outcomes are the gap.',
    keywords: ['career change', 'upskilling roadmap', 'portfolio project', 'interview prep', 'salary negotiation'],
    platforms: ['linkedin', 'youtube', 'tiktok', 'reddit'],
  },
  {
    id: 'food-meal-prep',
    label: 'Meal Prep for Real Schedules',
    category: 'Food & Drink',
    summary:
      'Batch cooking built around a weekly rhythm, with cost per portion and reheating quality treated as first-class constraints.',
    audience: ['Shift workers', 'Students', 'Gym-goers', 'Busy parents'],
    demand: 'very high',
    demandNote: 'Consistent year-round search demand with strong Pinterest and Shorts pull.',
    monetization: ['Recipe packs', 'Grocery affiliate', 'App subscription', 'Sponsored series'],
    contentAngles: [
      'Five dinners from one shop, costed',
      'Freezer strategy that survives a busy week',
      'High-protein prep without powders',
      'Reheat quality ranking by dish',
    ],
    competitorLandscape:
      'Very crowded; a cost-per-portion or dietary-constraint angle creates room.',
    keywords: ['meal prep', 'batch cooking', 'budget meals', 'high protein', 'weekly plan'],
    platforms: ['youtube', 'instagram', 'tiktok', 'pinterest'],
  },
  {
    id: 'budget-travel',
    label: 'Budget & Slow Travel',
    category: 'Travel',
    summary:
      'Practical trip planning for people paying their own way: routing, shoulder season timing, and what things actually cost.',
    audience: ['Young professionals', 'Remote workers', 'Families on a budget', 'Sabbatical planners'],
    demand: 'high',
    demandNote: 'Highly seasonal; evergreen cost guides carry the off-season.',
    monetization: ['Itinerary sales', 'Booking affiliate', 'Card affiliate', 'Guides'],
    contentAngles: [
      'A full trip cost sheet, line by line',
      'Shoulder-season swap that halves the price',
      'What tourists overpay for',
      'Two weeks, one carry-on',
    ],
    competitorLandscape:
      'Influencer travel is saturated; cost-transparent, destination-specific planning stands out.',
    keywords: ['budget travel', 'trip cost', 'itinerary', 'shoulder season', 'packing list'],
    platforms: ['youtube', 'instagram', 'pinterest', 'tiktok'],
  },
  {
    id: 'skincare-science',
    label: 'Evidence-Based Skincare',
    category: 'Beauty',
    summary:
      'Ingredient-literate routines for common concerns, with expectations set by evidence instead of transformation promises.',
    audience: ['Acne sufferers', 'Sensitive skin', 'Late starters', 'Budget shoppers'],
    demand: 'high',
    demandNote: 'Enormous demand and heavy competition; accuracy is the differentiator.',
    monetization: ['Routine guides', 'Retail affiliate', 'Consultations', 'Brand deals'],
    contentAngles: [
      'Ingredient label decoded in 60 seconds',
      'Building a routine for under a set budget',
      'What actually causes purging',
      'When to see a dermatologist',
    ],
    competitorLandscape:
      'Dermatologist creators set authority; non-medical creators must cite sources carefully.',
    keywords: ['skincare routine', 'ingredients', 'sensitive skin', 'acne basics', 'barrier repair'],
    platforms: ['youtube', 'tiktok', 'instagram', 'pinterest'],
  },
  {
    id: 'diy-woodworking',
    label: 'Small-Space Woodworking',
    category: 'DIY',
    summary:
      'Builds that fit a balcony or single garage bay, using a short tool list and honest material costs.',
    audience: ['Apartment makers', 'First-time buyers', 'Hobbyists', 'Gift builders'],
    demand: 'steady',
    demandNote: 'Steady, project-driven demand with strong seasonal gift spikes.',
    monetization: ['Plan sales', 'Tool affiliate', 'Lumber sponsor', 'Workshops'],
    contentAngles: [
      'One build, five tools, real cost sheet',
      'Beginner mistakes that ruin a joint',
      'Shop storage that fits a closet',
      'Finishing schedule for a durable surface',
    ],
    competitorLandscape:
      'Large shops dominate; small-space and budget constraints are underserved.',
    keywords: ['woodworking plans', 'small shop', 'beginner build', 'finishing', 'budget tools'],
    platforms: ['youtube', 'pinterest', 'instagram', 'reddit'],
  },
  {
    id: 'early-years-parenting',
    label: 'Early Years Parenting',
    category: 'Family',
    summary:
      'Practical routines for the first five years: sleep, feeding, play, and language development, grounded in mainstream guidance.',
    audience: ['New parents', 'Second-time parents', 'Caregivers', 'Grandparents'],
    demand: 'high',
    demandNote: 'Constant demand; accuracy and warmth matter more than volume.',
    monetization: ['Routine guides', 'Printable trackers', 'Course', 'Sponsorships'],
    contentAngles: [
      'A nap schedule that adapts to real life',
      'Language-building play with no toys',
      'Feeding transitions without pressure',
      'What to do when a routine collapses',
    ],
    competitorLandscape:
      'Consultant-led brands dominate; local or constraint-specific angles (small flats, shift work) are open.',
    keywords: ['baby routine', 'toddler sleep', 'first foods', 'language development', 'play ideas'],
    platforms: ['youtube', 'instagram', 'pinterest', 'facebook'],
  },
];

export function getNiche(id: string | null): Niche | null {
  if (!id) return null;
  return NICHES.find((n) => n.id === id) ?? null;
}

export function nicheCategories(): string[] {
  return Array.from(new Set(NICHES.map((n) => n.category))).sort();
}

/** Real, working search URLs — no invented metrics, no fabricated competitor lists. */
export function researchLinks(niche: Niche): NicheResearchLink[] {
  const q = encodeURIComponent(niche.keywords[0] ?? niche.label);
  const qAll = encodeURIComponent(niche.keywords.slice(0, 3).join(' '));
  return [
    { label: 'YouTube search', url: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Google Trends', url: `https://trends.google.com/trends/explore?q=${q}` },
    { label: 'Reddit discussions', url: `https://www.reddit.com/search/?q=${q}&sort=top&t=year` },
    { label: 'TikTok search', url: `https://www.tiktok.com/search?q=${q}` },
    { label: 'Pinterest search', url: `https://www.pinterest.com/search/pins/?q=${q}` },
    { label: 'X search', url: `https://x.com/search?q=${qAll}&f=top` },
    { label: 'Google keyword ideas', url: `https://www.google.com/search?q=${q}+keywords+ideas` },
    { label: 'Google Keyword Planner', url: 'https://ads.google.com/home/tools/keyword-planner/' },
  ];
}

export function competitorLinks(niche: Niche): NicheResearchLink[] {
  const q = encodeURIComponent(niche.keywords[0] ?? niche.label);
  return [
    { label: 'Top YouTube channels', url: `https://www.youtube.com/results?search_query=${q}&sp=CAMSAhAB` },
    { label: 'Top Shorts', url: `https://www.youtube.com/results?search_query=${q}&sp=EgIYAQ%253D%253D` },
    { label: 'Instagram tags', url: `https://www.instagram.com/explore/tags/${(niche.keywords[0] ?? 'brand').replace(/\s+/g, '')}/` },
    { label: 'TikTok hashtag', url: `https://www.tiktok.com/tag/${(niche.keywords[0] ?? 'brand').replace(/\s+/g, '')}` },
    { label: 'Reddit top posts', url: `https://www.reddit.com/search/?q=${q}&sort=top&t=all` },
    { label: 'Product Hunt', url: `https://www.producthunt.com/search?q=${q}` },
  ];
}

export function platformResearchLinks(niche: Niche, platform: PlatformId): NicheResearchLink[] {
  const q = encodeURIComponent(niche.keywords[0] ?? niche.label);
  const map: Record<PlatformId, NicheResearchLink> = {
    youtube: { label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
    tiktok: { label: 'TikTok', url: `https://www.tiktok.com/search?q=${q}` },
    instagram: { label: 'Instagram', url: `https://www.instagram.com/explore/tags/${(niche.keywords[0] ?? 'brand').replace(/\s+/g, '')}/` },
    facebook: { label: 'Facebook', url: `https://www.facebook.com/search/top?q=${q}` },
    x: { label: 'X', url: `https://x.com/search?q=${q}&f=top` },
    pinterest: { label: 'Pinterest', url: `https://www.pinterest.com/search/pins/?q=${q}` },
    threads: { label: 'Threads', url: `https://www.threads.com/search?q=${q}` },
    linkedin: { label: 'LinkedIn', url: `https://www.linkedin.com/search/results/content/?keywords=${q}` },
    twitch: { label: 'Twitch', url: `https://www.twitch.tv/search?term=${q}` },
    reddit: { label: 'Reddit', url: `https://www.reddit.com/search/?q=${q}` },
  };
  return niche.platforms.map((p) => map[p]).filter(Boolean);
}
