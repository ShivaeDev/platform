import { releaseOnly } from "#engine/releaseOnly.ts";
import type { Decision } from "#policy.ts";

export function decisionAnswer(input: Decision) {
	if (input.worker !== undefined) {
		return "Record your answer below to continue the worker in its existing thread. Use a guided release answer or the release command to free terminal ownership instead.";
	}
	const explanation = releaseOnly(input.reason);
	const retryText = "Retry after the blocker is resolved under trusted runtime policy.";
	const retry = explanation === undefined ? `:::option{id="retry"}\n${retryText}\n:::\n\n` : "";
	return `${explanation === undefined ? "" : `${explanation}\n\n`}::::question{id="fleet-action" select="one"}\n### How should Fleet proceed?\n\n${retry}:::option{id="release"}\nSafely release this work's ownership if execution and delivery permit it.\n:::\n::::`;
}
