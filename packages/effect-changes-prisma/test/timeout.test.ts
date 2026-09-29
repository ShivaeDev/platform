import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test } from "vitest";
import { configuredTimeout } from "../src/expiry.ts";
import { PrismaClient } from "./generated/client.ts";

const client = (timeout?: number) =>
	new PrismaClient({
		adapter: new PrismaPg({ connectionString: "postgresql://never-connected" }),
		...(timeout === undefined ? {} : { transactionOptions: { timeout } }),
	});

test("reads the transaction timeout a Prisma client was constructed with, also through $extends", () => {
	expect(configuredTimeout(client(1234))).toBe(1234);
	expect(configuredTimeout(client(1234).$extends({}))).toBe(1234);
	expect(configuredTimeout(client())).toBe(5000);
});

test("sets no deadline of its own when the client's configuration cannot be read", () => {
	expect(configuredTimeout({})).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: {} })).toBeUndefined();
	expect(configuredTimeout({ _engineConfig: { transactionOptions: { timeout: "5000" } } })).toBeUndefined();
});
