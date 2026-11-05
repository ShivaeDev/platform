import { expect } from "@effect/vitest";
import { exceptionStory } from "#test/exceptionStory.ts";

const REASON = "The parser owns the external format.";
const VALID = { _tag: "Valid" };
const INVALID = { _tag: "Invalid" };
exceptionStory.it("accept one reason for a Quality rule and an individual Biome rule on an explicit file", [], function* ({ decodeDeclarations }) {
	const entries = [{ files: ["src/parse.ts"], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] }];

	expect(yield* decodeDeclarations(entries)).toEqual({ ...VALID, value: entries });
});

for (const [label, entry] of [
	["no reason", { files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }],
	["a blank reason", { files: ["src/parse.ts"], reason: " ", rules: ["comments/no-jsdoc"] }],
	["a glob for a Quality rule", { files: ["src/*.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
	["a path outside the repository", { files: ["../parse.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
	["all of Biome's lint rules", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint"] }],
	["a whole Biome group", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious"] }],
	["a glob for a Biome rule", { files: ["src/*.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }],
	["Biome's formatter", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/format"] }],
	["a subject on a Biome rule", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"], subject: "any" }],
] satisfies ReadonlyArray<readonly [unknown, unknown]>) {
	exceptionStory.it(`refuse a declaration with ${label}`, [], function* ({ decodeDeclarations }) {
		expect(yield* decodeDeclarations([entry])).toMatchObject(INVALID);
	});
}

exceptionStory.it("accept every file but a named generated folder for biome/files/includes", [], function* ({ decodeDeclarations }) {
	expect(yield* decodeDeclarations([{ files: ["**", "!**/test-support/generated"], reason: REASON, rules: ["biome/files/includes"] }])).toMatchObject(
		VALID,
	);
});

exceptionStory.it("refuse a file-pattern exclusion for biome/files/includes", [], function* ({ decodeDeclarations }) {
	expect(yield* decodeDeclarations([{ files: ["**", "!**/*.ts"], reason: REASON, rules: ["biome/files/includes"] }])).toMatchObject(INVALID);
});
