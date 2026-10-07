import { PrismaPg } from "@prisma/adapter-pg";
import { expect, it } from "vitest";
import { configuredTimeout } from "#expiry.ts";
import { PrismaClient } from "#test/generated/client.ts";

function client(timeout?: number) {
	return new PrismaClient({
		adapter: new PrismaPg({ connectionString: "postgresql://never-connected" }),
		...(timeout === undefined ? {} : { transactionOptions: { timeout } }),
	});
}

it("reads the transaction timeout a Prisma client was constructed with, also through $extends", () => {
	expect(configuredTimeout(client(1234))).toBe(1234);
	expect(configuredTimeout(client(1234).$extends({}))).toBe(1234);
	expect(configuredTimeout(client())).toBe(5000);
});

it("sets no deadline of its own when the client's configuration cannot be read", () => {
	expect(configuredTimeout({})).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: {} })).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: { transactionOptions: { timeout: "5000" } } })).toBeUndefined();
});
