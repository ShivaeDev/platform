import { runKnip } from "#adapters/knip/run.ts";
import { defineRule } from "#rule.ts";

export const unusedCode = defineRule({
	check: runKnip,
	description:
		"Reports unused files, exports and package dependencies, and missing dependencies, through knip. Reach code from declared entry points or remove it; record existing debt in the baseline.",
	id: "code/unused",
	registrable: false,
});
