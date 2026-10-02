export type ThumbmakerThumbnail = {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
  image: string;
  link: string | null;
  jobId: string | null;
  status: string;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ThumbmakerThumbnailsListResponse = {
  data: ThumbmakerThumbnail[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
