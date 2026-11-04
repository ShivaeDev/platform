import { Cache, type Effect } from "effect";
import type { viewerRepositoryAccess } from "#viewerRepositoryAccess.ts";

export function viewerRepositories(viewers: Effect.Success<ReturnType<typeof viewerRepositoryAccess>>) {
	return (account: number | string) => Cache.get(viewers, typeof account === "number" ? `id:${account}` : `login:${account.toLowerCase()}`);
}
