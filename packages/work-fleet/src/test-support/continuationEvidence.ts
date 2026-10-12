import { Effect } from "effect";
import type { CodexRequest } from "#providers/codexTurns.ts";

export function continuationEvidence(requests: string[], read: () => "matching" | "unrelated" | "empty"): CodexRequest {
	return (method) =>
		Effect.sync(() => {
			requests.push(method);
			const evidence = read();
			const matching = evidence === "matching";
			const turn = {
				id: matching ? "answer-turn" : "question-turn",
				items: [{ clientId: matching ? "answer-operation" : "question-operation", id: "input", type: "userMessage" }],
				status: matching ? "inProgress" : "completed",
			};
			return { data: evidence === "empty" ? [] : [turn], nextCursor: null };
		});
}
