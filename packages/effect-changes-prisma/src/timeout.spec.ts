import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { clientIsConfigured } from "#test/prismaTraits.ts";

prisma.it(
	"reads the transaction timeout a Prisma client was constructed with, also through $extends",
	[clientIsConfigured({ timeout: 1234 })],
	function* ({ client, timeoutOf }) {
		expect(yield* timeoutOf(client)).toBe(1234);
		expect(yield* timeoutOf(client.$extends({}))).toBe(1234);
	},
);

prisma.it("reads Prisma's default transaction timeout", [], function* ({ client, timeoutOf }) {
	expect(yield* timeoutOf(client)).toBe(5000);
});

prisma.it("sets no deadline of its own when the client's configuration cannot be read", [], function* ({ timeoutOf }) {
	expect(yield* timeoutOf({})).toBeUndefined();
	expect(yield* timeoutOf({ _engineConfig: {} })).toBeUndefined();
	expect(yield* timeoutOf({ _engineConfig: { transactionOptions: { timeout: "5000" } } })).toBeUndefined();
});
