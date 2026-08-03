import { describe, expect, it } from "vitest";
import { normalizePrismaNextContractTypes } from "../src/internal/contract-normalization.js";

describe("Prisma Next contract normalization", () => {
	it("replaces timestamp output declarations with Date", () => {
		const source = [
			"readonly createdAt: Timestamp<6>;",
			"readonly verifiedAt: Timestamptz<3> | null;",
		].join("\n");

		expect(normalizePrismaNextContractTypes(source)).toBe(
			["readonly createdAt: Date;", "readonly verifiedAt: Date | null;"].join(
				"\n",
			),
		);
	});

	it("is safe to run repeatedly and on contracts without timestamps", () => {
		const source = "readonly email: string;";
		expect(normalizePrismaNextContractTypes(source)).toBe(source);
	});

	it("supports declarations without an explicit timestamp precision", () => {
		expect(
			normalizePrismaNextContractTypes(
				"readonly createdAt: Timestamp<undefined>;",
			),
		).toBe("readonly createdAt: Date;");
	});

	it("replaces timestamp codec input and output references with Date", () => {
		const source = [
			"readonly createdAt: CodecTypes['pg/timestamp@1']['output'];",
			"readonly updatedAt: CodecTypes['pg/timestamptz@1']['input'];",
		].join("\n");

		expect(normalizePrismaNextContractTypes(source)).toBe(
			["readonly createdAt: Date;", "readonly updatedAt: Date;"].join("\n"),
		);
	});

	it("fails when Prisma emits an unsupported timestamp type shape", () => {
		expect(() =>
			normalizePrismaNextContractTypes(
				"readonly createdAt: Timestamp<Precision>;",
			),
		).toThrow("Unsupported Prisma Next timestamp declaration");
	});
});
