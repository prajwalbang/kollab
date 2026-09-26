import { z } from "zod";
export const followerBands = [
  "under_1k",
  "1k_5k",
  "5k_10k",
  "10k_25k",
  "25k_50k",
  "50k_100k",
  "over_100k",
] as const;
export type FollowerBand = (typeof followerBands)[number];
export type IdentityMode = "anonymous" | "attributed";
export const dealTypes = [
  "barter",
  "paid",
  "paid_plus_product",
  "affiliate_only",
  "exposure_only",
] as const;
export const paymentStatuses = [
  "paid_on_time",
  "paid_late",
  "partially_paid",
  "never_paid",
  "not_applicable",
] as const;
export const ghostStages = [
  "none",
  "before_agreement",
  "after_agreement",
  "after_content_sent",
  "after_posting",
  "during_payment",
] as const;
export type User = {
  id: string;
  instagram_user_id: string | null;
  handle_encrypted: string | null;
  alias: string;
  avatar_seed: string;
  follower_band: FollowerBand;
  primary_category: string;
  secondary_categories: string[];
  city: string | null;
  region: string | null;
  verified_at: string | null;
  verification_method: "instagram" | "bio_code" | "story_code" | null;
  karma: number;
  contribution_count: number;
  role: "creator" | "moderator" | "admin" | "brand_rep";
  created_at: string;
  banned_at: string | null;
  ban_reason: string | null;
};
export const brandInput = z.object({
  name: z.string().trim().min(2),
  instagram_handle: z.string().trim().min(2),
  category: z.string().min(1),
  website: z.union([z.literal(""), z.url()]).nullable(),
  entity_type: z.enum(["brand", "agency"]),
});
export type NewBrand = z.infer<typeof brandInput>;
export type BrandRecord = NewBrand & {
  id: string;
  slug: string;
  logo_url: string | null;
  hq_city: string | null;
  is_claimed: boolean;
  claimed_by_user_id: string | null;
  status: "active" | "pending_review" | "merged" | "hidden";
  merged_into_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
};
// Presentation metadata is separate from the exact database record.
export type Brand = Omit<
  BrandRecord,
  "created_by_user_id" | "claimed_by_user_id"
> & { demo: boolean; color: string; review_count: number };
export type Deliverables = {
  reels: number;
  stories: number;
  static_posts: number;
  ugc_raw: number;
  event_attendance: number;
};
export const reviewInput = z.object({
  identity_mode: z.enum(["anonymous", "attributed"]).optional(),
  attribution_consent: z.boolean().optional(),
  brand_id: z.string().min(1),
  agency_id: z.string().nullable(),
  collab_month: z.string().regex(/^\d{4}-\d{2}$/),
  deal_type: z.enum(dealTypes),
  cash_amount_inr: z.number().nonnegative(),
  product_claimed_value_inr: z.number().nonnegative().nullable(),
  product_actual_value_inr: z.number().nonnegative().nullable(),
  deliverables: z.object({
    reels: z.number().int().nonnegative(),
    stories: z.number().int().nonnegative(),
    static_posts: z.number().int().nonnegative(),
    ugc_raw: z.number().int().nonnegative(),
    event_attendance: z.number().int().nonnegative(),
  }),
  initial_offer_inr: z.number().nonnegative().nullable(),
  final_amount_inr: z.number().nonnegative(),
  payment_status: z.enum(paymentStatuses),
  days_to_payment: z.number().int().nonnegative().nullable(),
  ghost_stage: z.enum(ghostStages),
  usage_rights_requested: z.boolean(),
  usage_rights_paid_separately: z.boolean(),
  ran_as_paid_ad_without_payment: z.boolean(),
  revisions_requested: z.number().int().nonnegative(),
  scope_creep: z.boolean(),
  had_written_agreement: z.boolean(),
  rating_communication: z.number().int().min(1).max(5),
  rating_professionalism: z.number().int().min(1).max(5),
  rating_payment: z.number().int().min(1).max(5),
  would_work_again: z.boolean(),
  body: z.string().max(1200).nullable(),
});
export type NewReview = z.infer<typeof reviewInput>;
export type CollabReview = NewReview & {
  id: string;
  user_id: string;
  proof_status: "none" | "pending" | "verified" | "rejected";
  visibility: "published" | "pending_review" | "removed";
  trust_score: number;
  helpful_count: number;
  created_at: string;
  edited_at: string | null;
  removed_reason: string | null;
};
export type ReviewProof = {
  id: string;
  review_id: string;
  storage_path: string;
  proof_type:
    "dm_screenshot" | "email" | "invoice" | "contract" | "bank_credit";
  reviewed_by: string | null;
  verdict: "pending" | "verified" | "rejected";
  reviewed_at: string | null;
};
export type BrandReply = {
  id: string;
  review_id: string;
  brand_id: string;
  body: string;
  created_at: string;
};
// Public projections omit identities, exact dates and all private proof data at the repo boundary.
export type Review = Omit<
  CollabReview,
  "user_id" | "created_at" | "edited_at" | "removed_reason"
> & {
  attribution_handle?: string | null;
  author_alias?: string;
  brand?: Brand;
  follower_band: FollowerBand;
  category: string;
  region: string | null;
  reply: string | null;
  demo: boolean;
};
export type Session = {
  role?: 'creator' | 'brand_rep' | 'moderator' | 'admin';
  id: string;
  alias: string;
  handle: string;
  contributions: number;
  follower_band: FollowerBand;
  category: string;
  city: string | null;
  verified?: boolean;
};
export type ReviewFilters = {
  q?: string;
  band?: string;
  category?: string;
  deal_type?: string;
  year?: string;
};
export type RateFilters = {
  q?: string;
  category?: string;
  band?: string;
  deal_type?: string;
  city?: string;
  deliverable?: string;
  brand_id?: string;
};
export type Aggregates = {
  count: number;
  would_work_again: number | null;
  on_time_rate: number | null;
  ghost_rate: number | null;
  median_days_to_payment: number | null;
  median_cash: number | null;
  product_claimed_value: number | null;
  product_actual_value: number | null;
};
export type RateRow = {
  brand_name?: string;
  category: string;
  band?: string;
  deal_type?: string;
  deliverable?: string;
  brand_id?: string | null;
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
};
export type RoomPost = {
  id: string;
  category: string;
  body: string;
  alias: string;
  identity_mode?: IdentityMode;
  attribution_handle?: string | null;
  helpful_count: number;
  comments: { id: string; body: string; alias: string; identity_mode?: IdentityMode; attribution_handle?: string | null }[];
  created_at: string;
};
export type Notification = {
  id: string;
  brand_id: string;
  message: string;
  read: boolean;
};
export type Report = {
  id: string;
  target_id: string;
  reason: string;
  created_at: string;
};
