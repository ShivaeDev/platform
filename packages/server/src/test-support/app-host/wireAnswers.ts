import { Predicate } from "effect";

function reasonOf(reason: unknown): unknown {
	if (Predicate.hasProperty(reason, "_tag")) {
		if (reason._tag === "Fail" && Predicate.hasProperty(reason, "error")) {
			return { failed: reason.error };
		}
		if (reason._tag === "Die" && Predicate.hasProperty(reason, "defect")) {
			return { died: reason.defect };
		}
		if (reason._tag === "Interrupt") {
			return "interrupted";
		}
	}
	return { unreadable: reason };
}

function exitOf(exit: unknown): unknown {
	if (Predicate.hasProperty(exit, "_tag") && exit._tag === "Success" && Predicate.hasProperty(exit, "value")) {
		return { succeeded: exit.value };
	}
	if (Predicate.hasProperty(exit, "cause") && Array.isArray(exit.cause)) {
		const reasons = exit.cause.map(reasonOf);
		return reasons.length === 1 ? reasons[0] : reasons;
	}
	return { unreadable: exit };
}

function answer(answers: Record<string, unknown>, id: string, value: unknown) {
	const earlier = answers[id];
	answers[id] = earlier === undefined ? value : [...(Array.isArray(earlier) ? earlier : [earlier]), value];
}

export function wireAnswers(text: string): Readonly<Record<string, unknown>> {
	const answers: Record<string, unknown> = {};
	for (const line of text
		.trim()
		.split("\n")
		.filter((value) => value !== "")) {
		const message: unknown = JSON.parse(line);
		if (Predicate.hasProperty(message, "_tag") && message._tag === "Exit" && Predicate.hasProperty(message, "exit")) {
			answer(answers, String(Predicate.hasProperty(message, "requestId") ? message.requestId : "unknown"), exitOf(message.exit));
		} else if (Predicate.hasProperty(message, "_tag") && message._tag === "Defect" && Predicate.hasProperty(message, "defect")) {
			answers.connection = { "connection defect": message.defect };
		} else {
			answers.unreadable = message;
		}
	}
	return answers;
}
