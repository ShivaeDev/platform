import { defineRule, type Finding, type SourceFile } from "#rule.ts";

const DECLARATION = /\.d\.[cm]?ts$/u;
const TOO_DEEP = /^\t{8,}/u;

function findingsOf(file: SourceFile): readonly Finding[] {
	return file.lines.flatMap((text, index) =>
		TOO_DEEP.test(text)
			? [
					{
						file: file.path,
						line: index + 1,
						message: "Indentation is 8+ tabs deep. Extract a named function or component.",
					},
				]
			: [],
	);
}

export const maxDepth = defineRule({
	check: ({ sources }) => sources.filter((file) => !DECLARATION.test(file.path)).flatMap(findingsOf),
	description: "Extract a named function or component before indentation reaches eight tabs.",
	id: "nesting/max-depth",
});
