import { releaseOnly } from "#engine/releaseOnly.ts";
import type { Decision } from "#policy.ts";

export function decisionAnswer(input: Decision) {
	if (input.worker !== undefined) {
		return "Record your answer on this item’s answer card to continue the worker in its existing thread. Use a guided release answer or the release command to free terminal ownership instead.";
	}
	const explanation = releaseOnly(input.code);
	const retryText = "### Request changes\nFleet keeps the branch and PR and works on your answer";
	const retry = explanation === undefined ? `:::option{id="retry"}\n${retryText}\n:::\n\n` : "";
	return `${explanation === undefined ? "" : `${explanation}\n\n`}::::question{id="fleet-action" select="one"}\n### How should Fleet proceed?\n\n${retry}:::option{id="release"}\n### Release\nFleet stops and hands the work back\n:::\n::::`;
}
