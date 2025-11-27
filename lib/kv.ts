import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const env = process.env.VERCEL_ENV ?? "local";

export const REFRESH_TOKEN_KV = {
  get: () => redis.get<string>(`gmail-agent:refresh_token:${env}`),
  set: (refreshToken: string) =>
    redis.set(`gmail-agent:refresh_token:${env}`, refreshToken),
};

export const LAST_PROCESSED_TIMESTAMP_KV = {
  get: () => redis.get<number>(`gmail-agent:last_processed_ts:${env}`),
  set: (timestamp: number) =>
    redis.set(`gmail-agent:last_processed_ts:${env}`, timestamp),
  delete: () => redis.del(`gmail-agent:last_processed_ts:${env}`),
};

export const PROCESSED_EMAILS_KV = {
  set: (emailId: string) =>
    redis.set(`gmail-agent:processed:${emailId}:${env}`, "1", {
      nx: true,
      ex: 60 * 60 * 24 * 30,
    }),
  deleteAll: async () => {
    const pattern = `gmail-agent:processed:*:${env}`;
    let deletedCount = 0;
    let done = false;
    let cursor = 0;

    while (!done) {
      const result = await redis.scan(cursor, { match: pattern, count: 100 });
      const nextCursor = Number(result[0]);
      const keys = result[1];

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }

      if (nextCursor === 0) {
        done = true;
      } else {
        cursor = nextCursor;
      }
    }

    return deletedCount;
  },
};
