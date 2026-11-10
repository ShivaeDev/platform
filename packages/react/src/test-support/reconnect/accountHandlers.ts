import { Effect, Layer, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { Accounts, SessionGuard } from "#test/reconnect/feature.ts";

export function accountHandlers() {
	const accounts: { authorized: boolean; failures: string[]; reads: string[] } = { authorized: true, failures: [], reads: [] };
	const guard = Layer.succeed(SessionGuard, (next) =>
		Effect.suspend(() => {
			if (!accounts.authorized) {
				accounts.failures.push("signed out");
				return Effect.fail(new Unauthorized({ message: "Session ended" }));
			}
			return next;
		}),
	);
	const application = Accounts.application.toLayer({
		"reconnectAccounts.get": ({ page }) =>
			Effect.sync(() => {
				accounts.reads.push(page);
				return "Alice's account";
			}),
	});
	const changes = changesHandlerLayer(Accounts, () =>
		Effect.map(
			makeLiveServer,
			(live) =>
				({ queries }, options) =>
					Stream.unwrap(
						Effect.gen(function* () {
							const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
							return live.subscribe(subscription, rerunQuery(Accounts.application, options));
						}),
					),
		),
	);
	const layer = Layer.mergeAll(application, changes.pipe(Layer.provide(application)), guard).pipe(Layer.provide(Reactivity.layer));
	return { accounts, layer };
}
