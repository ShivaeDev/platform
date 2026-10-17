import { describe, expect, it } from "vitest";
import { decodeExceptions } from "./declaration.ts";

const REASON = "The parser owns the external format.";

describe("exception declarations", () => {
	it("accepts one reason for Quality and individual Biome rules", async () => {
		const entries = [{ files: ["src/parse.ts"], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] }];
		expect(await decodeExceptions(entries)).toEqual({ _tag: "Valid", value: entries });
	});

	it.each([
		{ files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] },
		{ files: ["src/parse.ts"], reason: " ", rules: ["comments/no-jsdoc"] },
		{ files: ["src/*.ts"], reason: REASON, rules: ["comments/no-jsdoc"] },
		{ files: ["../parse.ts"], reason: REASON, rules: ["comments/no-jsdoc"] },
		{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint"] },
		{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious"] },
		{ files: ["src/*.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] },
		{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/format"] },
		{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"], subject: "any" },
	])("rejects invalid or unexplained scope: %j", async (entry) => {
		expect(await decodeExceptions([entry])).toMatchObject({ _tag: "Invalid" });
	});

	it("retains the narrow generated-directory exclusion policy", async () => {
		expect(await decodeExceptions([{ files: ["**", "!**/test-support/generated"], reason: REASON, rules: ["biome/files/includes"] }])).toMatchObject({
			_tag: "Valid",
		});
		expect(await decodeExceptions([{ files: ["**", "!**/*.ts"], reason: REASON, rules: ["biome/files/includes"] }])).toMatchObject({
			_tag: "Invalid",
		});
	});
});
