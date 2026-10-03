import { Effect, Schema } from "effect";
import { defineConfig, defineRule, type QualityConfig, type Rule } from "../src/index.ts";

const todo = defineRule({ check: () => [], description: "Resolve TODOs.", id: "local/no-todo" });

const limited = defineRule({
	check: ({ files, options }) => {
		const max: number = options.max;
		return files.length > max ? [{ file: ".", message: "too many files" }] : [];
	},
	description: "Keep the repository small.",
	id: "local/max-files",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))) })),
});

const rules: readonly Rule[] = [todo, limited];

export const typed: QualityConfig<readonly [typeof todo, typeof limited]> = defineConfig({
	adopt: ["local/no-todo", "comments/no-jsdoc"],
	local: [todo, limited],
	rules: {
		"comments/max-per-file": { options: { allow: ["@license"], max: 3 } },
		"comments/no-jsdoc": { options: { allow: ["@license"] } },
		"comments/no-todo": "off",
		"local/max-files": { options: { max: 3 } },
		"local/no-todo": "warn",
		"structure/max-lines": { level: "error", options: { source: 200, testFiles: ["e2e/"] } },
		"suppressions/biome-overrides": {
			options: { declared: [{ includes: ["src/legacy/**"], reason: "Migrating off the old API.", rule: "lint/style/noNonNullAssertion" }] },
		},
		"suppressions/no-double-cast": "warn",
	},
	sources: ["src"],
});

export const loose = defineConfig({ local: rules });

export const unknownRule = defineConfig({
	rules: {
		// @ts-expect-error A rule id that no rule has is rejected.
		"structure/max-line": "error",
	},
});

export const wrongOption = defineConfig({
	// @ts-expect-error Options are typed by the rule's schema.
	rules: { "structure/max-lines": { options: { source: "150" } } },
});

export const misspelledOption = defineConfig({
	// @ts-expect-error Option names are checked too.
	rules: { "structure/max-lines": { options: { sourc: 150 } } },
});

export const commentLimit = defineConfig({
	// @ts-expect-error The comment limit is a number.
	rules: { "comments/max-per-file": { options: { max: "2" } } },
});

export const patternOptions = defineConfig({
	// @ts-expect-error The pattern rules take no options.
	rules: { "comments/no-banner": { options: { allow: [] } } },
});

export const optionsForNone = defineConfig({
	local: [todo],
	// @ts-expect-error A rule without an options schema takes no options.
	rules: { "local/no-todo": { options: { strict: true } } },
});

export const wrongLevel = defineConfig({
	// @ts-expect-error Levels are error, warn and off.
	rules: { "structure/max-lines": "warning" },
});

export const localOnlyWithLocal = defineConfig({
	// @ts-expect-error A local rule's settings need the rule in local.
	rules: { "local/max-files": { options: { max: 3 } } },
});

export const declaredIgnore = defineConfig({
	rules: {
		// @ts-expect-error Only @ts-expect-error can be declared for type tests.
		"suppressions/no-inline": { options: { declared: [{ directive: "@ts-ignore", includes: ["*.ts"], reason: "No." }] } },
	},
});

export const adoptUnknown = defineConfig({
	// @ts-expect-error Only a known rule can be adopted.
	adopt: ["comments/no-todos"],
});
