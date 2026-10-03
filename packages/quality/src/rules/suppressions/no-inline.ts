import { Effect, Schema } from "effect";
import ignore from "ignore";
import { CONFIG_FILE } from "../../config/file.ts";
import { defineRule, type Finding, type RuleInputs } from "../../rule.ts";
import { type SourceComment, scanComments } from "../comments/scan.ts";
import { suppressionIn } from "./directives.ts";
import { STYLESHEET, stylesheetComments } from "./stylesheet-comments.ts";

const Declaration = Schema.Struct({
	directive: Schema.Literal("@ts-expect-error"),
	includes: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/u, { expected: "a reason that says why these files assert type errors" })),
});

type Declaration = typeof Declaration.Type;

const NoInlineOptions = Schema.Struct({
	declared: Schema.Array(Declaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

interface Site extends Finding {
	readonly subject: string;
}

const sitesIn = (file: string, comments: readonly SourceComment[]): readonly Site[] =>
	comments.flatMap((comment) => {
		const directive = suppressionIn(comment);
		return directive === undefined ? [] : [{ file, line: comment.line, message: `Suppresses a check: "${directive}".`, subject: directive }];
	});

const stylesheetSites = async ({ files, readText, sources }: RuleInputs): Promise<readonly Site[]> => {
	const read = files.filter((path) => STYLESHEET.test(path));
	const texts = await Promise.all(read.map(async (path) => sources.find((source) => source.path === path)?.text ?? (await readText(path))));
	return read.flatMap((path, index) => sitesIn(path, stylesheetComments(path, texts[index] ?? "")));
};

const allows = (declaration: Declaration, site: Site): boolean =>
	declaration.directive === site.subject
	&& ignore()
		.add([...declaration.includes])
		.ignores(site.file);

const unused = (declaration: Declaration): Finding => ({
	file: CONFIG_FILE,
	message: `Declares "${declaration.directive}" for ${declaration.includes.map((glob) => `"${glob}"`).join(", ")}, which matches no directive. Remove the declaration.`,
	subject: declaration.directive,
});

export const noInline = defineRule({
	check: async (inputs) => {
		const { declared } = inputs.options;
		const sites = [...inputs.sources.flatMap((file) => sitesIn(file.path, scanComments(file))), ...(await stylesheetSites(inputs))];
		return [
			...sites.filter((site) => !declared.some((declaration) => allows(declaration, site))),
			...declared.filter((declaration) => !sites.some((site) => allows(declaration, site))).map(unused),
		];
	},
	description:
		"A suppression silences a check at one site instead of fixing the cause. Fix the code; where a lint rule truly cannot apply, turn it off for that scope in the Biome config and declare it under suppressions/biome-overrides.",
	id: "suppressions/no-inline",
	options: Schema.toStandardSchemaV1(NoInlineOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	registrable: false,
});
