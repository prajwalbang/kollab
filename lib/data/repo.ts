import type {
  Brand,
  NewBrand,
  Review,
  NewReview,
  ReviewFilters,
  RateFilters,
  RateRow,
  Aggregates,
  Session,
  RoomPost,
  Notification,
  FollowerBand,
  IdentityMode,
} from "./types";
export interface KollabRepo {
  searchBrands(query: string, limit?: number): Promise<Brand[]>;
  getBrand(slug: string): Promise<Brand | null>;
  createBrand(input: NewBrand): Promise<Brand>;
  findSimilarBrands(name: string, handle?: string): Promise<Brand[]>;
  listReviews(brandId?: string, filters?: ReviewFilters): Promise<Review[]>;
  createReview(input: NewReview): Promise<Review>;
  getBrandAggregates(brandId: string): Promise<Aggregates>;
  getRates(filters: RateFilters): Promise<RateRow[]>;
  getWatchlist(): Promise<Brand[]>;
  toggleWatchlist(brandId: string): Promise<boolean>;
  getSession(): Promise<Session | null>;
  setSession(
    mode: "logged_out" | "new" | "contributor",
    handle?: string,
  ): Promise<Session | null>;
  updateProfile(profile: {
    alias: string;
    follower_band: FollowerBand;
    category: string;
    city: string | null;
  }): Promise<Session>;
  listPosts(category: string, query?: string): Promise<RoomPost[]>;
  createPost(category: string, body: string, identityMode?: IdentityMode): Promise<RoomPost>;
  comment(postId: string, body: string, identityMode?: IdentityMode): Promise<void>;
  vote(targetId: string): Promise<boolean>;
  report(targetId: string, reason: string): Promise<void>;
  getNotifications(): Promise<Notification[]>;
  markNotificationsRead(): Promise<void>;
  reset(): Promise<void>;
}
