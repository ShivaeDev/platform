import { Effect, Schema } from "effect";
import { defineRule, type Finding } from "../../rule.ts";
import { biomeConfigs, type Chain } from "./biome/configs.ts";
import { Declaration, matches, type Scoped, scoped, scopeText } from "./biome/declarations.ts";
import { type Weakening, weakeningsOf } from "./biome/weakenings.ts";

const BiomeOverridesOptions = Schema.Struct({
	declared: Schema.Array(Declaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

interface Shipped extends Scoped {
	readonly specifier: string;
}

const shippedBy = ({ base, layers }: Chain): ReadonlyArray<Shipped> =>
	layers.flatMap(({ preset }) =>
		preset === undefined
			? []
			: preset.declared.map(({ includes, rule }) => ({ includes: includes.map((glob) => scoped(base, glob)), rule, specifier: preset.specifier })),
	);

const undeclared = ({ includes, layer, line, rule }: Weakening): Finding =>
	layer.preset === undefined
		? { file: layer.path, line, message: `Weakens "${rule}" for ${scopeText(includes)} without a declaration.`, subject: rule }
		: {
				file: layer.preset.file,
				line: layer.preset.line,
				message: `Extends "${layer.preset.specifier}", which weakens "${rule}" for ${scopeText(includes)} without a declaration.`,
				subject: rule,
			};

const unused = (file: string, declaration: Scoped): Finding => ({
	file,
	message: `Declares "${declaration.rule}" for ${scopeText(declaration.includes)}, which no Biome config weakens. Remove the declaration.`,
	subject: declaration.rule,
});

const repeated = (file: string, declaration: Scoped, shipped: Shipped): Finding => ({
	file,
	message: `Declares "${declaration.rule}" for ${scopeText(declaration.includes)}, which "${shipped.specifier}" already declares. Remove the declaration.`,
	subject: declaration.rule,
});

const staleOrRepeated = (file: string, weakenings: ReadonlyArray<Weakening>, shipped: ReadonlyArray<Shipped>) => (declaration: Scoped) => {
	if (!weakenings.some((weakening) => matches(declaration, weakening))) {
		return [unused(file, declaration)];
	}
	const already = shipped.find((candidate) => matches(declaration, candidate));
	return already === undefined ? [] : [repeated(file, declaration, already)];
};

export const biomeOverrides = defineRule({
	id: "suppressions/biome-overrides",
	description:
		"A Biome setting that turns a check off or down, or keeps files out of it, is an exception for every file it covers. Fix the code and remove the setting, or declare its rule, includes and reason under this rule's declared option.",
	options: Schema.toStandardSchemaV1(BiomeOverridesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	registrable: false,
	check: async (inputs) => {
		const { chains, problems, root } = await biomeConfigs(inputs);
		const { declared } = inputs.options;
		const weakenings = chains.flatMap(weakeningsOf);
		const shipped = chains.flatMap(shippedBy);
		const covered = (weakening: Weakening): boolean => [...declared, ...shipped].some((declaration) => matches(declaration, weakening));
		return [
			...problems,
			...weakenings.filter((weakening) => !covered(weakening)).map(undeclared),
			...declared.flatMap(staleOrRepeated(root, weakenings, shipped)),
		];
	},
});
