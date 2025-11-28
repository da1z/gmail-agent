import {
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { createHash } from "node:crypto";

const createKey = (params: LanguageModelV3CallOptions) => {
  return createHash("sha256").update(JSON.stringify(params)).digest("hex");
};

const createResultFromCachedObject = (
  obj: any
): Awaited<ReturnType<LanguageModelV3["doGenerate"]>> => {
  if (obj?.response?.timestamp) {
    obj.response.timestamp = new Date(obj.response.timestamp);
  }
  return obj as any;
};

export type StorageValue = string | number | null | object;

export type CacheStore = {
  get: (key: string) => Promise<StorageValue>;
  set: (key: string, value: StorageValue) => Promise<void>;
};

export const cacheModel = (
  model: LanguageModelV3,
  storage: CacheStore
): LanguageModelV3 => {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: async (opts) => {
        const key = createKey(opts.params);

        const resultFromCache = await storage.get(key);

        if (resultFromCache && typeof resultFromCache === "object") {
          const result = createResultFromCachedObject(resultFromCache);

          // Reset the tokens to 0 to show in the UI
          // that they were cached.
          result.usage.inputTokens = 0;
          result.usage.outputTokens = 0;
          result.usage.totalTokens = 0;

          return result;
        }

        const generated = await opts.doGenerate();

        await storage.set(key, JSON.stringify(generated));

        return generated;
      },
    },
  });
};
