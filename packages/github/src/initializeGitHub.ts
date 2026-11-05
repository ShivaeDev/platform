import { Effect } from "effect";
import { responseCache } from "#cache.ts";
import { rateLimits } from "#rateLimits.ts";

export const initializeGitHub = Effect.sync(() => ({ cache: responseCache(), rates: rateLimits() }));
export type GitHubState = Effect.Success<typeof initializeGitHub>;
