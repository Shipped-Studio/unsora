import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY as string,
});

export { getKieClient } from "./kie-api";
export { getWavespeedClient } from "./wavespeed-api";