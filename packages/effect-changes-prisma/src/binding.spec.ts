import { Effect } from "effect";
import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";

prisma.it("bindings with the same name from two copies of the package keep their clients apart", [], function* ({ client, anotherBinding, copies }) {
	const { first, second } = yield* copies();
	const other = yield* anotherBinding();
	const seen = yield* Effect.service(second.Client).pipe(Effect.provideService(first.Client, other.client));
	expect(seen).toBe(client);
});
