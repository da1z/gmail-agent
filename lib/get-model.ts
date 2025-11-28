import type { LanguageModelV3 } from "@ai-sdk/provider";
import { gateway, GatewayModelId } from "ai";

const isRunningInEvalite = () => !!process.env.EVALITE_REPORT_TRACES;

export const getModel = async (
  modelId: GatewayModelId
): Promise<LanguageModelV3> => {
  const model = gateway(modelId);

  if (!isRunningInEvalite()) {
    return model;
  }

  const [{ cacheModel }, { traceAISDKModel }, { createStorage }, fsDriver] =
    await Promise.all([
      import("./cache-model.js"),
      import("evalite/ai-sdk"),
      import("unstorage"),
      import("unstorage/drivers/fs"),
    ]);

  const storage = createStorage({
    driver: (fsDriver as any).default({ base: "./llm-cache.local" }),
  });

  // Type assertion needed: evalite uses @ai-sdk/provider@^2 (LanguageModelV2)
  // while this project uses @3.0.0-beta (LanguageModelV3). Runtime is compatible.
  const cachedModel = cacheModel(model, storage);
  return traceAISDKModel(cachedModel as any) as unknown as LanguageModelV3;
};
