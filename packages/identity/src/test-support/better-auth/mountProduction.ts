import process from "node:process";
import { Effect } from "effect";
import { emptyMount, startMountHost } from "./mountHost.ts";

const engine = emptyMount();
await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			yield* startMountHost(engine);
			const status = yield* Effect.promise(async () => {
				const response = await fetch(`${engine.urls[0]}/api/auth/visitor`);
				await response.text();
				return response.status;
			});
			process.stdout.write(JSON.stringify({ logs: engine.providerLogs, status }));
		}),
	),
);
