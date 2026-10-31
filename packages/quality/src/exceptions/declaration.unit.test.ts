import { describe, expect, it } from "vitest";
import { decodeExceptions } from "./declaration.ts";

const REASON = "The parser owns the external format.";
const VALID = { _tag: "Valid" };
const INVALID = { _tag: "Invalid" };

describe("exception declarations", () => {
	it("accept one reason for a Quality rule and an individual Biome rule on an explicit file", () => {
		const entries = [{ files: ["src/parse.ts"], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] }];

		return expect(decodeExceptions(entries)).resolves.toEqual({ ...VALID, value: entries });
	});

	it.each([
		["no reason", { files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }],
		["a blank reason", { files: ["src/parse.ts"], reason: " ", rules: ["comments/no-jsdoc"] }],
		["a glob for a Quality rule", { files: ["src/*.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
		["a path outside the repository", { files: ["../parse.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
		["all of Biome's lint rules", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint"] }],
		["a whole Biome group", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious"] }],
		["a glob for a Biome rule", { files: ["src/*.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }],
		["Biome's formatter", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/format"] }],
		["a subject on a Biome rule", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"], subject: "any" }],
	])("refuse a declaration with %s", (_, entry) => expect(decodeExceptions([entry])).resolves.toMatchObject(INVALID));

	it("accept every file but a named generated folder for biome/files/includes", () =>
		expect(
			decodeExceptions([{ files: ["**", "!**/test-support/generated"], reason: REASON, rules: ["biome/files/includes"] }]),
		).resolves.toMatchObject(VALID));

	it("refuse a file-pattern exclusion for biome/files/includes", () =>
		expect(decodeExceptions([{ files: ["**", "!**/*.ts"], reason: REASON, rules: ["biome/files/includes"] }])).resolves.toMatchObject(INVALID));
});
