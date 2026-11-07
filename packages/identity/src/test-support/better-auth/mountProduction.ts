import process from "node:process";
import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { emptyMount, startMountHost } from "#test/better-auth/mountHost.ts";
import { withControlledDate } from "#test/clock.ts";

const engine = emptyMount();
await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			yield* TestClock.setTime(Number(process.argv[2]));
			yield* Effect.gen(function* () {
				yield* startMountHost(engine).pipe(Effect.provide(memoryStore));
				const status = yield* Effect.promise(async () => {
					const response = await fetch(`${engine.urls[0]}/api/auth/visitor`);
					await response.text();
					return response.status;
				});
				process.stdout.write(JSON.stringify({ address: engine.providerView?.address ?? null, logs: engine.providerLogs, status }));
			}).pipe(withControlledDate);
		}),
	).pipe(Effect.provide(TestClock.layer())),
);
