import { expect, it } from "vitest";
import { configuredTimeout } from "#expiry.ts";
import { prisma } from "#test/prisma.ts";

prisma.it("reads the transaction timeout a Prisma client was constructed with, also through $extends", [], function* ({ clientTimeouts }) {
	expect(yield* clientTimeouts).toEqual([1234, 1234, 5000]);
});

it("sets no deadline of its own when the client's configuration cannot be read", () => {
	expect(configuredTimeout({})).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: {} })).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: { transactionOptions: { timeout: "5000" } } })).toBeUndefined();
});
