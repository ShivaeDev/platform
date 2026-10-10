import { Effect } from "effect";
import { expect, it, vi } from "vitest";

interface Client {
	$transaction: <X>(run: (tx: Client) => Promise<X>) => Promise<X>;
}

const client: Client = { $transaction: (run) => run(client) };
const other: Client = { $transaction: (run) => run(other) };

async function bind() {
	vi.resetModules();
	const { makePrismaChanges } = await import("#changes.ts");
	return makePrismaChanges({ client, models: {}, name: "Same", publish: () => Effect.void });
}

it("bindings with the same name from two copies of the package keep their clients apart", async () => {
	const first = await bind();
	const second = await bind();

	const seen = Effect.runSync(Effect.service(second.Client).pipe(Effect.provideService(first.Client, other)));

	expect(seen).toBe(client);
});
