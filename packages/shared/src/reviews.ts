export type PublishedReviewPage = {
  reviews: {
    id: string;
    alias: string;
    stars: number;
    comment: string | null;
    published_at: string;
    reply: string | null;
  }[];
  count: number;
  average: number | null;
  distribution: number[];
};
