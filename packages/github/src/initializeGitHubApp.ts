import { cachedLookup } from "#adapters/cachedLookup.ts";
import { viewerRepositoryAccess } from "#viewerRepositoryAccess.ts";
export const initializeGitHubApp = cachedLookup(viewerRepositoryAccess);
