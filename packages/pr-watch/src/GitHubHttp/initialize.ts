import { Effect } from "effect";

export const initializeGitHubHttp = Effect.sync(() => ({ requests: 0, retryAt: 0 }));
export type HttpState = Effect.Success<typeof initializeGitHubHttp>;
