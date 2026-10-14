import { Effect } from "effect";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { composerHtml } from "#server/responses/composerHtml.ts";
import { historyHtml } from "#server/responses/historyHtml.ts";

export const answerCardsHtml = Effect.fn("WorkBoard.answerCardsHtml")(function* (requests: readonly DocumentRequest[], enabled: boolean) {
	const cards = yield* Effect.forEach(
		requests.filter((request) => request.open),
		(request) => {
			const unavailable = request.unavailable ?? request.promptUnavailable;
			if (unavailable || !request.preview) {
				return Effect.gen(function* () {
					const history = request.preview && !request.unavailable ? yield* historyHtml(request.preview, request.responses ?? []) : "";
					return `<section class="response-panel"><h2>Answer unavailable</h2><p role="status">${escapeHtml(unavailable ?? "Response unavailable")}</p>${history}</section>`;
				});
			}
			return composerHtml(request.preview, request.responses ?? [], enabled, { title: request.title ?? "this question" });
		},
	);
	return cards.length > 0 ? `<div class="answer-cards col-span-full">${cards.join("")}</div>` : "";
});
