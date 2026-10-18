import { Effect, Schema } from "effect";
import { defineConfig, type QualityConfig } from "#config.ts";
import { defineRule, type Rule } from "#rule.ts";

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
	local: [todo, limited],
	rules: {
		"comments/max-per-file": { options: { allow: ["@license"], max: 2 } },
		"comments/no-jsdoc": { options: { allow: ["@license"] } },
		"comments/no-todo": "error",
		"local/max-files": { options: { max: 3 } },
		"local/no-todo": "error",
		"structure/max-lines": { level: "error", options: { source: 100 } },
		"suppressions/biome-overrides": {
			options: { declared: [{ includes: ["src/legacy/**"], reason: "Migrating off the old API.", rule: "lint/style/noNonNullAssertion" }] },
		},
		"suppressions/no-double-cast": "error",
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
	// @ts-expect-error Every configured rule runs at error.
	rules: { "structure/max-lines": "warning" },
});

export const localOnlyWithLocal = defineConfig({
	// @ts-expect-error A local rule's settings need the rule in local.
	rules: { "local/max-files": { options: { max: 3 } } },
});

export const declaredTypeTests = defineConfig({
	rules: {
		// @ts-expect-error Type tests are allowed by their file name, so no-inline takes no declarations.
		"suppressions/no-inline": { options: { declared: [{ directive: "@ts-expect-error", includes: ["*.ts"], reason: "No." }] } },
	},
});

export const warningRemoved = defineConfig({
	// @ts-expect-error Rules cannot be downgraded to warnings.
	rules: { "structure/max-lines": "warn" },
});

export const offRemoved = defineConfig({
	// @ts-expect-error Rules cannot be disabled with an object setting either.
	rules: { "structure/max-lines": { level: "off" } },
});

export const exclusionsRemoved = defineConfig({
	// @ts-expect-error Source exclusions cannot weaken the inventory.
	exclude: ["src/legacy/**"],
});

export const testPatternsRemoved = defineConfig({
	// @ts-expect-error Source files cannot be reclassified to use the test limit.
	rules: { "structure/max-lines": { options: { testFiles: ["src/**"] } } },
});

export const sharedException = defineConfig({
	exceptions: [
		{
			files: ["src/parse.ts"],
			reason: "The parser returns the external format.",
			rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"],
		},
	],
});

export const unexplainedException = defineConfig({
	// @ts-expect-error Every exception requires a reason.
	exceptions: [{ files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }],
});
