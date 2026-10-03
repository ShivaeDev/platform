import { defineRule, type Finding, type SourceFile } from "../../rule.ts";
import { assertionsIn, bridgeOf, lineOf } from "./assertions.ts";

const doubleCasts = (file: SourceFile): ReadonlyArray<Finding> => {
	const parsed = assertionsIn(file);
	if (parsed === undefined) {
		return [];
	}
	return parsed.assertions.flatMap((node) => {
		const bridge = bridgeOf(node);
		return bridge === undefined
			? []
			: [
					{
						file: file.path,
						line: lineOf(parsed.source, node),
						message: `Casts through "${bridge.through}" to reach a type the value does not have.`,
					},
				];
	});
};

export const noDoubleCast = defineRule({
	id: "suppressions/no-double-cast",
	description:
		"A cast through unknown, any or never silences the compiler the way a suppression does. Decode the value at its boundary, narrow it, or fix the type that disagrees.",
	registrable: false,
	check: ({ sources }) => sources.flatMap(doubleCasts),
});
