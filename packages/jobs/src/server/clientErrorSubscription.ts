import { Effect } from "effect";
import type { PgBossClient } from "#server/adapters/client.ts";
import { subscribeClientErrors } from "#server/adapters/clientErrors.ts";

export function clientErrorSubscription(client: PgBossClient, report: (error: Error) => void) {
	return Effect.sync(() => subscribeClientErrors(client, report));
}
