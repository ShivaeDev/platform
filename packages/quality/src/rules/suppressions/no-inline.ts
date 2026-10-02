import { defineRule, type Finding, type RuleInputs } from "../../rule.ts";
import { type SourceComment, scanComments } from "../comments/scan.ts";
import { suppressionIn } from "./directives.ts";
import { STYLESHEET, stylesheetComments } from "./stylesheet-comments.ts";

const findingsIn = (file: string, comments: ReadonlyArray<SourceComment>): ReadonlyArray<Finding> =>
	comments.flatMap((comment) => {
		const directive = suppressionIn(comment);
		return directive === undefined ? [] : [{ file, line: comment.line, message: `Suppresses a check: "${directive}".`, subject: directive }];
	});

const stylesheetFindings = async ({ files, readText, sources }: RuleInputs): Promise<ReadonlyArray<Finding>> => {
	const read = files.filter((path) => STYLESHEET.test(path));
	const texts = await Promise.all(read.map(async (path) => sources.find((source) => source.path === path)?.text ?? (await readText(path))));
	return read.flatMap((path, index) => findingsIn(path, stylesheetComments(path, texts[index] ?? "")));
};

export const noInline = defineRule({
	id: "suppressions/no-inline",
	description:
		"A suppression silences a check at one site instead of fixing the cause. Fix the code; where a lint rule truly cannot apply, turn it off for that scope in the Biome config and declare it under suppressions/biome-overrides.",
	registrable: false,
	check: async (inputs) => [...inputs.sources.flatMap((file) => findingsIn(file.path, scanComments(file))), ...(await stylesheetFindings(inputs))],
});
