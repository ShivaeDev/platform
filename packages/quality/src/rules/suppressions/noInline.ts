import { Effect } from "effect";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { type SourceComment, scanComments } from "#rules/comments/scan.ts";
import { suppressionIn } from "#rules/suppressions/in.ts";
import { STYLESHEET, stylesheetComments } from "#rules/suppressions/stylesheetComments.ts";

const TYPE_TEST = /(?:(?:^|\/)typecheck\.test|\.typecheck\.(?:test|spec))\.[cm]?[jt]sx?$/u;

const TYPE_TEST_DIRECTIVE = "@ts-expect-error";

interface Site extends Finding {
	readonly subject: string;
}

function sitesIn(file: string, comments: readonly SourceComment[]): readonly Site[] {
	return comments.flatMap((comment) => {
		const directive = suppressionIn(comment);
		return directive === undefined ? [] : [{ file, line: comment.line, message: `Suppresses a check: "${directive}".`, subject: directive }];
	});
}

const stylesheetSites = Effect.fn("Suppressions.stylesheetSites")(function* ({ files, readText, sources }: RuleInputs) {
	const read = files.filter((path) => STYLESHEET.test(path));
	const texts = yield* Effect.forEach(
		read,
		(path) => {
			const known = sources.find((source) => source.path === path)?.text;
			return known === undefined ? readText(path) : Effect.succeed(known);
		},
		{ concurrency: "unbounded" },
	);
	return read.flatMap((path, index) => sitesIn(path, stylesheetComments(path, texts[index] ?? "")));
});

function allowed(site: Site): boolean {
	return site.subject === TYPE_TEST_DIRECTIVE && TYPE_TEST.test(site.file);
}

export const noInline = defineRule({
	check: Effect.fn("NoInline.check")(function* (inputs) {
		const stylesheets = yield* stylesheetSites(inputs);
		return [...inputs.sources.flatMap((file) => sitesIn(file.path, scanComments(file))), ...stylesheets].filter((site) => !allowed(site));
	}),
	description:
		"A suppression silences a check at one site instead of fixing the cause. Repair the code that fails the check and remove the suppression. A type test asserts a compile error with @ts-expect-error in a *.typecheck.test.ts or *.typecheck.spec.ts file.",
	id: "suppressions/no-inline",
	registrable: false,
});
