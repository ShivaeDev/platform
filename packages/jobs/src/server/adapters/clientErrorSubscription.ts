import { Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { subscribeClientErrors } from "#server/clientErrors.ts";

export function clientErrorSubscription(client: PgBossClient, report: (error: Error) => void) {
	return Effect.sync(() => subscribeClientErrors(client, report));
}
