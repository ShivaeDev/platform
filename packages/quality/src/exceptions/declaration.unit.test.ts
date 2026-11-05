import { describe } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { decodeExceptions } from "./declaration.ts";

const REASON = "The parser owns the external format.";
const VALID = { _tag: "Valid" };
const INVALID = { _tag: "Invalid" };

describe("exception declarations", () => {
	it.effect("accept one reason for a Quality rule and an individual Biome rule on an explicit file", function* () {
		const entries = [{ files: ["src/parse.ts"], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] }];

		yield* assertThat(yield* Effect.promise(() => decodeExceptions(entries)), (actual) => actual.toEqual({ ...VALID, value: entries }));
	});

	it.effect.each([
		["no reason", { files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }],
		["a blank reason", { files: ["src/parse.ts"], reason: " ", rules: ["comments/no-jsdoc"] }],
		["a glob for a Quality rule", { files: ["src/*.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
		["a path outside the repository", { files: ["../parse.ts"], reason: REASON, rules: ["comments/no-jsdoc"] }],
		["all of Biome's lint rules", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint"] }],
		["a whole Biome group", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious"] }],
		["a glob for a Biome rule", { files: ["src/*.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }],
		["Biome's formatter", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/format"] }],
		["a subject on a Biome rule", { files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"], subject: "any" }],
	] satisfies ReadonlyArray<readonly [unknown, unknown]>)("refuse a declaration with %s", function* ([_, entry]) {
		yield* assertThat(yield* Effect.promise(() => decodeExceptions([entry])), (actual) => actual.toMatchObject(INVALID));
	});

	it.effect("accept every file but a named generated folder for biome/files/includes", function* () {
		yield* assertThat(
			yield* Effect.promise(() =>
				decodeExceptions([{ files: ["**", "!**/test-support/generated"], reason: REASON, rules: ["biome/files/includes"] }]),
			),
			(actual) => actual.toMatchObject(VALID),
		);
	});

	it.effect("refuse a file-pattern exclusion for biome/files/includes", function* () {
		yield* assertThat(
			yield* Effect.promise(() => decodeExceptions([{ files: ["**", "!**/*.ts"], reason: REASON, rules: ["biome/files/includes"] }])),
			(actual) => actual.toMatchObject(INVALID),
		);
	});
});
