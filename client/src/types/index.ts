export interface CreateUrlResponse {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
}

export interface UrlStats {
  shortCode: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
}

/** Session-level entry. clicks/createdAt fill in once stats are fetched. */
export interface RecentLink extends CreateUrlResponse {
  clicks: number | null;
  createdAt: string | null;
}
