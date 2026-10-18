// Prisma 7 reads connection URLs here, not from schema.prisma. Migrations use the direct (non-pooled) URL when set.
export default {
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
};
