import { Effect } from "effect";
import { vi } from "vitest";

interface Client {
	$transaction: <TX>(run: (tx: Client) => Promise<TX>) => Promise<TX>;
}

async function bind(client: Client) {
	vi.resetModules();
	const { makePrismaChanges } = await import("#changes.ts");
	return makePrismaChanges({ client, models: {}, name: "Same", publish: () => Effect.void });
}

export const bindingIsolation = Effect.fn("PrismaStory.bindingIsolation")(function* () {
	const client: Client = { $transaction: (run) => run(client) };
	const other: Client = { $transaction: (run) => run(other) };
	const first = yield* Effect.promise(() => bind(client));
	const second = yield* Effect.promise(() => bind(client));
	return {
		client,
		clientFromOtherCopy: Effect.service(second.Client).pipe(Effect.provideService(first.Client, other)),
	};
});
