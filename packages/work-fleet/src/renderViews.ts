import type { State, Work } from "./domain.ts";
import { activeAttempt } from "./state.ts";

function text(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replace(/[\\`*_{}[\]()#+.!|]/gu, "\\$&")
		.replaceAll("\n", " ");
}
function link(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? `[Open](${url.href.replaceAll("(", "%28").replaceAll(")", "%29")})` : text(value);
	} catch {
		return text(value);
	}
}
function outcome(work: Work) {
	if (!work.outcome) {
		return "Awaiting an outcome.";
	}
	if (work.outcome.kind === "no-change") {
		return `No change at ${text(work.outcome.revision)}: ${text(work.outcome.justification)}`;
	}
	if (work.outcome.kind === "branch") {
		return `Branch revision: ${text(work.outcome.revision)}`;
	}
	return `Pull request: ${link(work.outcome.url)} — ${text(work.outcome.revision)}`;
}
function card(work: Work, state: State) {
	const attempts = state.attempts.filter((attempt) => attempt.workId === work.spec.id);
	const active = attempts
		.filter(activeAttempt)
		.map((attempt) => `${attempt.role}: ${attempt.status}`)
		.join(", ");
	return `## ${text(work.spec.id)}\n\n${text(work.spec.instructions)}\n\nRepository: ${text(work.spec.repository)}. Phase: ${work.phase}. Completion: ${work.spec.completion}.\n\n${outcome(work)}\n\n${active ? `Execution: ${active}.` : `Attempts: ${attempts.length}.`}\n${work.review ? `\nReview: ${work.review.verdict} at ${text(work.review.revision)} — ${text(work.review.summary)}\n` : ""}`;
}
function page(title: string, cards: ReadonlyArray<string>) {
	return `# ${title}\n\nGenerated from durable fleet state. Use the CLI to change decisions.\n\n${cards.length > 0 ? cards.join("\n") : "No items.\n"}`;
}
export function renderViews(state: State): Readonly<{
	Active: string;
	Completed: string;
	NeedsHuman: string;
}> {
	const used = state.attempts.filter(activeAttempt).length;
	const holds = [state.policy.stopped ? "Admissions stopped." : "", state.policy.quotaAvailable ? "" : "Quota unavailable."]
		.filter(Boolean)
		.join(" ");
	return {
		Active: page("Active", [
			`Capacity: ${used}/${state.policy.capacity}. ${holds}\n`,
			...state.works.filter((work) => work.phase !== "completed").map((work) => card(work, state)),
		]),
		Completed: page(
			"Completed",
			state.works.filter((work) => work.phase === "completed").map((work) => card(work, state)),
		),
		NeedsHuman: page(
			"Needs human",
			state.works
				.filter((work) => work.question !== null)
				.map((work) => {
					const question = work.question;
					return `${card(work, state)}\nQuestion: ${text(question?.question ?? "")}\n\nContext: ${text(question?.context ?? "")}\n\nRecommendation: ${text(question?.recommendation ?? "")}\n\n${link(question?.link ?? "")}\n`;
				}),
		),
	};
}
