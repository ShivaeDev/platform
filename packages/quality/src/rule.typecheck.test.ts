import { Effect, Schema } from "effect";
import { defineConfig } from "#config.ts";
import { defineRule, type Findings, type RegisteredRule, type Rule, type RuleContext } from "#rule.ts";
import { customServiceRule, type LineAllowance } from "#test/customServiceRule.ts";

const numeric = defineRule({
	check: ({ options }) => [{ file: "limit", message: options.max.toFixed(0) }],
	description: "Reports a numeric limit.",
	id: "local/numeric",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.Number })),
	validate: ({ options }) => (options.max > 0 ? [] : ["max must be positive"]),
});

const textual = defineRule({
	check: ({ options }) => Promise.resolve([{ file: "label", message: options.label.toUpperCase() }]),
	description: "Reports a label.",
	id: "local/textual",
	options: Schema.toStandardSchemaV1(Schema.Struct({ label: Schema.String })),
});

const none = defineRule({
	check: ({ options }) => {
		const absent: undefined = options;
		return [{ file: "none", message: String(absent) }];
	},
	description: "Takes no options.",
	id: "local/none",
});

export const registry = [numeric, textual, none, customServiceRule] as const satisfies readonly RegisteredRule<unknown>[];

export const erased: readonly RegisteredRule<unknown>[] = registry;

export const mixed = defineConfig({
	local: registry,
	rules: {
		"local/line-limit": { options: { max: "2" } },
		"local/none": "error",
		"local/numeric": { options: { max: 2 } },
		"local/textual": { options: { label: "hello" } },
	},
});

export const mixedWrong = defineConfig({
	local: registry,
	// @ts-expect-error A heterogeneous registry preserves each rule's options.
	rules: { "local/numeric": { options: { label: "hello" } } },
});

export const configured = numeric.configure({ max: 2 });
// @ts-expect-error Direct configuration rejects the wrong input type.
numeric.configure({ max: "2" });
// @ts-expect-error No-options rules reject supplied options.
none.configure({ max: 2 });
// @ts-expect-error A typed callback cannot promise to accept arbitrary registry input.
export const widened: Rule<string, unknown> = numeric;
// @ts-expect-error Callback input variance stays strict between different options.
export const incompatible: Rule<string, { readonly max: number | string }> = numeric;

export const decoded = defineRule({
	check: ({ options }) => [{ file: "decoded", message: options.max.toFixed(0) }],
	description: "Uses decoded options.",
	id: "local/decoded",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.NumberFromString })),
	validate: ({ options }) => {
		// @ts-expect-error Validation receives decoded numbers, not schema input strings.
		options.max.toUpperCase();
		return [];
	},
});

export const configuredDecoded = decoded.configure({ max: "2" });
// @ts-expect-error Direct configuration takes schema input, not decoded output.
decoded.configure({ max: 2 });

export const narrowedCheck = defineRule({
	// @ts-expect-error The overload without options also refuses a narrowed callback.
	check: ({ options }: RuleContext<{ readonly max: 1 }>) => [{ file: "limit", message: String(options.max) }],
	description: "Rejects an unsafely narrow callback.",
	id: "local/narrowed",
	// @ts-expect-error A check must handle every value its schema decodes.
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.Number })),
});

export const invalidSync = defineRule({
	// @ts-expect-error A finding needs a file and message.
	check: () => [{ message: "missing file" }],
	description: "Rejects incomplete findings.",
	id: "local/invalid-sync",
});

export const invalidPromise = defineRule({
	// @ts-expect-error Promise results must also contain valid findings.
	check: () => Promise.resolve([{ file: "bad", message: 2 }]),
	description: "Rejects invalid Promise findings.",
	id: "local/invalid-promise",
});

export const invalidEffect = defineRule({
	// @ts-expect-error Effect results must also contain valid findings.
	check: () => Effect.succeed([{ file: "bad", line: "2", message: "bad line" }]),
	description: "Rejects invalid Effect findings.",
	id: "local/invalid-effect",
});

type Ready = Extract<Awaited<ReturnType<typeof customServiceRule.configure>>, { readonly _tag: "Ready" }>;
export function serviceCheck(ready: Ready) {
	const check: Effect.Effect<Findings, unknown, LineAllowance> = ready.check({
		files: [],
		readText: () => Promise.resolve(undefined),
		root: ".",
		sources: [],
	});
	// @ts-expect-error Configuring a rule preserves the services its check needs.
	const withoutService: Effect.Effect<Findings, unknown, never> = check;
	return withoutService;
}
