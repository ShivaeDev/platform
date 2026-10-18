import { Effect, Schema } from "effect";
import { biomeExceptionHint, missingBiomeFiles } from "#exceptions/biomeFindings.ts";
import { defineRule, type Finding } from "#rule.ts";
import { ConsumerDeclaration } from "#rules/suppressions/biome/ConsumerDeclaration.ts";
import { biomeConfigs, type Chain } from "#rules/suppressions/biome/configs.ts";
import { matches, type Scoped, scoped, scopeText } from "#rules/suppressions/biome/declarations.ts";
import { type Weakening, weakeningsOf } from "#rules/suppressions/biome/weakenings.ts";

const BiomeOverridesOptions = Schema.Struct({
	declared: Schema.Array(ConsumerDeclaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

interface Shipped extends Scoped {
	readonly specifier: string;
}

function shippedBy({ base, layers }: Chain): readonly Shipped[] {
	return layers.flatMap(({ preset }) =>
		preset === undefined
			? []
			: preset.declared.map(({ includes, rule }) => ({ includes: includes.map((glob) => scoped(base, glob)), rule, specifier: preset.specifier })),
	);
}

function undeclared({ includes, layer, line, rule }: Weakening, configFile: string): Finding {
	return layer.preset === undefined
		? {
				file: layer.path,
				line,
				message: `Weakens "${rule}" for ${scopeText(includes)} without a declaration. Repair the code and remove the weakening setting.${Schema.is(ConsumerDeclaration)({ includes, reason: "Permanent exception.", rule }) ? biomeExceptionHint(includes, rule, configFile) : ""}`,
				subject: rule,
			}
		: {
				file: layer.preset.file,
				line: layer.preset.line,
				message: `Extends "${layer.preset.specifier}", which weakens "${rule}" for ${scopeText(includes)} without a declaration. Repair the code and restore the check in the preset.`,
				subject: rule,
			};
}

function unused(file: string, declaration: Scoped): Finding {
	return {
		file,
		message: `Declares "${declaration.rule}" for ${scopeText(declaration.includes)}, which no Biome config weakens. Remove the declaration.`,
		subject: declaration.rule,
	};
}

function repeated(file: string, declaration: Scoped, shipped: Shipped): Finding {
	return {
		file,
		message: `Declares "${declaration.rule}" for ${scopeText(declaration.includes)}, which "${shipped.specifier}" already declares. Remove the declaration.`,
		subject: declaration.rule,
	};
}

function staleOrRepeated(file: string, weakenings: readonly Weakening[], shipped: readonly Shipped[]) {
	return (declaration: Scoped) => {
		if (!weakenings.some((weakening) => matches(declaration, weakening))) {
			return [unused(file, declaration)];
		}
		const already = shipped.find((candidate) => matches(declaration, candidate));
		return already === undefined ? [] : [repeated(file, declaration, already)];
	};
}

export const biomeOverrides = defineRule({
	check: async (inputs) => {
		const { chains, problems, root } = await biomeConfigs(inputs);
		const { declared } = inputs.options;
		const weakenings = chains.flatMap(weakeningsOf);
		const shipped = chains.flatMap(shippedBy);
		function covered(weakening: Weakening): boolean {
			return [...declared, ...shipped].some((declaration) => matches(declaration, weakening));
		}
		return [
			...problems,
			...(await missingBiomeFiles(inputs)),
			...weakenings.filter((weakening) => !covered(weakening)).map((weakening) => undeclared(weakening, inputs.configFile ?? "quality.config.ts")),
			...declared.flatMap(staleOrRepeated(root, weakenings, shipped)),
		];
	},
	description:
		"A Biome setting that turns a check off or down, or keeps files out of it, hides findings for every file it covers. Repair the code and remove the weakening setting.",
	id: "suppressions/biome-overrides",
	options: Schema.toStandardSchemaV1(BiomeOverridesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	registrable: false,
});
