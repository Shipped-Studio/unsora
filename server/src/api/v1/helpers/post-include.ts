export const postInclude = {
  media: {
    orderBy: { order: "asc" as const },
    include: { asset: true },
  },
  postAccounts: {
    include: {
      account: {
        select: {
          id: true,
          provider: true,
          accountName: true,
          accountUsername: true,
          profilePicture: true,
        },
      },
    },
  },
};
