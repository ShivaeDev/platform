import { Effect, Schema } from "effect";
import { defineRule, type Finding } from "../../rule.ts";
import { biomeConfigs, type Config } from "./biome/configs.ts";
import { type Weakening, weakeningsOf } from "./biome/weakenings.ts";

const Declaration = Schema.Struct({
	rule: Schema.NonEmptyString,
	includes: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/, { expected: "a reason that says why the scope needs the rule weakened" })),
});

type Declaration = typeof Declaration.Type;

const BiomeOverridesOptions = Schema.Struct({
	declared: Schema.Array(Declaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const sameScope = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
	new Set(left).size === new Set(right).size && left.every((glob) => right.includes(glob));

const matches = (declaration: Declaration, weakening: Weakening): boolean =>
	declaration.rule === weakening.rule && sameScope(declaration.includes, weakening.includes);

const scopeText = (includes: ReadonlyArray<string>): string => includes.map((glob) => `"${glob}"`).join(", ");

const undeclared = (weakening: Weakening): Finding => ({
	file: weakening.file,
	line: weakening.line,
	message: `Weakens "${weakening.rule}" for ${scopeText(weakening.includes)} without a declaration.`,
	subject: weakening.rule,
});

const unused = (file: string, declaration: Declaration): Finding => ({
	file,
	message: `Declares "${declaration.rule}" for ${scopeText(declaration.includes)}, which no Biome config weakens. Remove the declaration.`,
	subject: declaration.rule,
});

const unreadable = (config: Config): ReadonlyArray<Finding> =>
	config._tag === "Unreadable" ? [{ file: config.path, message: `Cannot read this Biome config: ${config.reason}.` }] : [];

export const biomeOverrides = defineRule({
	id: "suppressions/biome-overrides",
	description:
		"A rule turned off or down in the Biome config is an exception for every file in its scope. Fix the code and remove the setting, or declare its rule, includes and reason under this rule's declared option.",
	options: Schema.toStandardSchemaV1(BiomeOverridesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	registrable: false,
	check: async (inputs) => {
		const configs = await biomeConfigs(inputs);
		const { declared } = inputs.options;
		const weakenings = configs.flatMap((config) => (config._tag === "Config" ? weakeningsOf(config.json, config.path, config.base) : []));
		const root = configs.find((config) => !config.path.includes("/"))?.path ?? "biome.json";
		return [
			...configs.flatMap(unreadable),
			...weakenings.filter((weakening) => !declared.some((declaration) => matches(declaration, weakening))).map(undeclared),
			...declared
				.filter((declaration) => !weakenings.some((weakening) => matches(declaration, weakening)))
				.map((declaration) => unused(root, declaration)),
		];
	},
});
