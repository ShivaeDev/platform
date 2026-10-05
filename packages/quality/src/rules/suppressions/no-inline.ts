import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { type SourceComment, scanComments } from "#rules/comments/scan.ts";
import { suppressionIn } from "./directives.ts";
import { STYLESHEET, stylesheetComments } from "./stylesheet-comments.ts";

const TYPE_TEST = /(?:(?:^|\/)typecheck\.test|\.typecheck\.(?:test|spec))\.[cm]?[jt]sx?$/u;

const TYPE_TEST_DIRECTIVE = "@ts-expect-error";

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

function allowed(site: Site): boolean {
	return site.subject === TYPE_TEST_DIRECTIVE && TYPE_TEST.test(site.file);
}

export const noInline = defineRule({
	check: async (inputs) =>
		[...inputs.sources.flatMap((file) => sitesIn(file.path, scanComments(file))), ...(await stylesheetSites(inputs))].filter(
			(site) => !allowed(site),
		),
	description:
		"A suppression silences a check at one site instead of fixing the cause. Fix the code; where a lint rule truly cannot apply, turn it off for that scope in the Biome config and declare it under suppressions/biome-overrides. A type test asserts a compile error with @ts-expect-error in a *.typecheck.test.ts or *.typecheck.spec.ts file.",
	id: "suppressions/no-inline",
	registrable: false,
});
