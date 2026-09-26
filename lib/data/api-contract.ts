import { z } from "zod";
import { brandInput, reviewInput, followerBands } from "./types";

const id = z.uuid();
const short = z.string().trim().max(120);
const empty = z.object({}).strict();
const identity = {
  identity_mode: z.enum(["anonymous", "attributed"]).default("anonymous"),
  attribution_consent: z.boolean().default(false),
};
const text = z.string().trim().min(1).max(1200);
export const readSchemas = {
  getSession: empty,
  searchBrands: z.object({ query: short.default(""), limit: z.number().int().min(1).max(100).optional() }).strict(),
  getBrand: z.object({ slug: z.string().max(160).regex(/^[a-z0-9-]+$/) }).strict(),
  listReviews: z.object({ brandId: id.optional(), filters: z.object({ q: short.optional(), band: short.optional(), category: short.optional(), deal_type: short.optional(), year: z.string().regex(/^\d{4}$/).optional() }).strict().optional() }).strict(),
  getBrandAggregates: z.object({ brandId: id }).strict(),
  getRates: z.object({ q: short.optional(), category: short.optional(), band: short.optional(), deal_type: short.optional(), city: short.optional(), deliverable: short.optional(), brand_id: id.optional() }).strict(),
  getWatchlist: empty,
  listPosts: z.object({ category: short, query: short.optional() }).strict(),
  getNotifications: empty,
  verificationStatus: empty,
  representativeReviews: z.object({company_id:id}).strict(),
} as const;
export const writeSchemas = {
  createBrand: brandInput.extend({ name: z.string().trim().min(2).max(120), instagram_handle: z.string().trim().regex(/^@?[a-zA-Z0-9._]{1,30}$/), category: z.string().min(1).max(60), website: z.union([z.literal(""), z.url().max(2048).refine((s) => new URL(s).protocol === "https:")]).nullable() }).strict(),
  createReview: reviewInput.extend({ brand_id: id, agency_id: id.nullable(), ...identity }).strict(),
  updateProfile: z.object({ alias: z.string().trim().min(2).max(40), follower_band: z.enum(followerBands), category: z.string().trim().min(1).max(60), city: z.string().trim().max(80).nullable() }).strict(),
  toggleWatchlist: z.object({ brandId: id }).strict(),
  createPost: z.object({ category: z.string().trim().min(1).max(60), body: text.min(10), ...identity }).strict(),
  comment: z.object({ post_id: id, body: text, ...identity }).strict(),
  vote: z.object({ targetId: id }).strict(),
  report: z.object({ targetId: id, reason: z.string().trim().min(1).max(500) }).strict(),
  markNotificationsRead: empty,
  verificationStart: z.object({ handle: z.string().trim().regex(/^@?[a-zA-Z0-9._]{1,30}$/) }).strict(),
  verificationSubmit: z.object({ challenge_id: id }).strict(),
  claimBrand: z.object({company_id:id,evidence:z.string().trim().min(20).max(2000)}).strict(),
  reply: z.object({review_id:id,body:z.string().trim().min(5).max(1200)}).strict(),
} as const;

export function parseDataRequest(action: string, input: unknown, write: boolean) {
  const schemas: Record<string, z.ZodType> = write ? writeSchemas : readSchemas;
  if (!Object.prototype.hasOwnProperty.call(schemas, action)) throw new Error("Unsupported action.");
  return schemas[action].parse(input);
}

export function databaseError(code?: string): { error: string; status: number } {
  if (code === "42501") return { error: "Sign in and complete verification, or check that your account has access.", status: 403 };
  if (code === "23505") return { error: "This entry already exists. Check for a duplicate before retrying.", status: 409 };
  if (code?.startsWith("22") || code?.startsWith("23")) return { error: "Some fields are invalid. Check your details and try again.", status: 400 };
  if (code === "P0001") return { error: "The action could not be completed. Check your account status and details, or wait before retrying.", status: 400 };
  return { error: "The service is temporarily unavailable. Please try again later.", status: 503 };
}
