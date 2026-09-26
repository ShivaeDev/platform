import { Effect } from "effect";
import { expect, test, vi } from "vitest";

interface Client {
	$transaction<X>(run: (tx: Client) => Promise<X>): Promise<X>;
}

const client: Client = { $transaction: (run) => run(client) };
const other: Client = { $transaction: (run) => run(other) };

const bind = async () => {
	vi.resetModules();
	const { makePrismaChanges } = await import("../src/index.ts");
	return makePrismaChanges({ name: "Same", client, models: {}, publish: () => Effect.void });
};

test("bindings with the same name from two copies of the package keep their clients apart", async () => {
	const first = await bind();
	const second = await bind();

	const seen = Effect.runSync(Effect.service(second.Client).pipe(Effect.provideService(first.Client, other)));

	expect(seen).toBe(client);
});
