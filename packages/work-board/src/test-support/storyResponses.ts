import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type { DraftInput } from "#browser/responses/schema.ts";
import type { browserClient } from "#client/client.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import type { Folder, RunningBoard } from "./board.ts";
import { renderRemaining } from "./renderRemaining.tsx";

const REVIEW_PATH = "/_board/result?item=result.keyboard";

export const handoffInput = Effect.fn("Story.handoffInput")(function* (client: ReturnType<typeof browserClient>) {
	const preview = yield* Effect.promise(() => client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" })));
	return {
		constraints: "Preserve no-JavaScript links.",
		goal: "Fix keyboard focus",
		id: "handoff.keyboard.1",
		item: preview.item,
		nextAction: "Inspect the current source and report browser evidence.",
		recipient: "agent-codex",
		revision: preview.reviewedRevision,
		source: preview.source,
	};
});

export const resultHtml = Effect.fn("Story.resultHtml")(function* (board: RunningBoard) {
	return yield* Effect.promise(() => renderRemaining(board.url, REVIEW_PATH));
});

export const reviewReport = Effect.fn("Story.reviewReport")(function* (
	client: ReturnType<typeof browserClient>,
	id: string,
	choice: string,
	supersedes?: string,
) {
	const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "result.keyboard", request: "review" })));
	const question = yield* Effect.promise(() =>
		client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
	);
	const draft: DraftInput = {
		answers: [
			{
				prompt: "verdict",
				selected: [choice],
				text:
					choice === "revision"
						? "Please record the narrow-screen limitation."
						: "Accept this report version; the missing criterion is still not proved.",
			},
		],
		author: "maintainer",
		body: "Human review of the stated limitations.",
		id,
		question: question.id,
		...(supersedes ? { supersedes } : {}),
		type: "answer",
	};
	return yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(draft)));
});

export function savedInboxAnswer(notes: Folder) {
	const saved = readdirSync(join(notes.root, "responses")).find((file) => file.startsWith("response."));
	if (!saved) {
		throw new Error("No response saved");
	}
	return metadataParse(readFileSync(join(notes.root, "responses", saved), "utf8"));
}

export function responseDraft(question: string, id = "response.first", body = "Use explicit requests.") {
	return {
		author: "maintainer",
		body,
		id,
		question,
		type: "answer" as const,
	};
}
