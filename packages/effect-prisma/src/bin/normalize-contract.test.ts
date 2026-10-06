import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { generatedContractFile as contract, removeGeneratedContractFiles, runNormalizeContract } from "#test/normalizeContractCommand.ts";

function normalize(path: string) {
	return runNormalizeContract([path]);
}
afterEach(removeGeneratedContractFiles);

it.each([[], ["first.d.ts", "second.d.ts"]])("reports the invocation syntax for an invalid argument list %j", (...arguments_) => {
	const result = runNormalizeContract(arguments_);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("Usage: effect-prisma-normalize <generated-contract.d.ts>");
});

it("normalizes generated timestamps, preserves other fields and can run twice", () => {
	const path = contract(
		[
			"readonly createdAt: Timestamp<6>;",
			"readonly verifiedAt: Timestamptz<3> | null;",
			"readonly deletedAt: Timestamp<undefined>;",
			"readonly output: CodecTypes['pg/timestamp@1']['output'];",
			"readonly input: CodecTypes['pg/timestamptz@1']['input'];",
			"readonly email: string;",
		].join("\n"),
	);
	const expected = [
		"readonly createdAt: Date;",
		"readonly verifiedAt: Date | null;",
		"readonly deletedAt: Date;",
		"readonly output: Date;",
		"readonly input: Date;",
		"readonly email: string;",
	].join("\n");
	for (let run = 0; run < 2; run += 1) {
		const result = normalize(path);
		expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
		expect(readFileSync(path, "utf8")).toBe(expected);
	}
});

it("refuses unsupported timestamp declarations without overwriting the generated file", () => {
	const source = "readonly createdAt: Timestamp<Precision>;";
	const path = contract(source);
	const result = normalize(path);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("Unsupported Prisma Next timestamp declaration");
	expect(readFileSync(path, "utf8")).toBe(source);
});
