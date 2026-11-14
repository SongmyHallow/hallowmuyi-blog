import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
  }),
});

const games = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/games' }),
  schema: z.object({
    title: z.string(),
    originalTitle: z.string().optional(),
    cover: z.string().url(),
    summary: z.string().optional(),
    developer: z.string().optional(),
    publisher: z.string().optional(),
    releaseDate: z.coerce.date().optional(),
    addedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    platforms: z.array(z.string()).default([]),
    genres: z.array(z.string()).default([]),
    officialUrl: z.string().url().optional(),
    scores: z
      .array(
        z.object({
          source: z.string(),
          score: z.string(),
        }),
      )
      .default([]),
    // 关联博客的 slug
    relatedPosts: z.array(z.string()).default([]),
    links: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          type: z.enum(['article', 'video']).default('article'),
          note: z.string().optional(),
          date: z.coerce.date().optional(),
        }),
      )
      .default([]),
    timeline: z
      .array(
        z.object({
          version: z.string(),
          date: z.coerce.date(),
          summary: z.string(),
          url: z.string().url().optional(),
        }),
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, pages, games };
