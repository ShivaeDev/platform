import type { DecisionCopy } from "#engine/decisionCopy.ts";
import type { Choice } from "#engine/situations/choices.ts";

export function decisionAnswer({ question }: DecisionCopy) {
	if (question === undefined) {
		return undefined;
	}
	const wait = question.wait === undefined ? "" : `${option("wait", question.wait)}\n`;
	const retry = question.retry === undefined ? "" : `${option("retry", question.retry)}\n`;
	return `::::question{id="fleet-action" select="one"}\n### ${question.title}\n\n${wait}${retry}${option("release", question.release)}::::`;
}

function option(id: string, choice: Choice) {
	return `:::option{id="${id}"}\n### ${choice.label}\n${choice.outcome}\n:::\n`;
}
