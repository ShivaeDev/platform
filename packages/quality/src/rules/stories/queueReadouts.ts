import { queueReadoutFindings } from "#adapters/queueReadoutFindings.ts";
import { defineRule } from "#rule.ts";

export const queueReadouts = defineRule({
	check: queueReadoutFindings,
	description: "Application tests assert job results, never jobs-testing queue storage; jobs and the test-kits controller test their own readouts.",
	id: "tests/queue-readouts",
	registrable: false,
});
