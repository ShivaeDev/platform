import { Effect } from "effect";
import { fileUrl } from "#files/url.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import { escapeHtml } from "#page/escape.ts";
import type { RenderFailed } from "#render/failed.ts";
import type { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { readResponses } from "#responses/read.ts";
import { malformedResponse, questionFrom, revisionOf } from "#responses/records.ts";
import type { Snapshot } from "#search/snapshot.ts";

export const resultFeedback = Effect.fn("WorkBoard.resultFeedback")(function* (
	result: MetadataDocument,
	data: Snapshot,
): Effect.fn.Return<string, RenderFailed, Highlighter> {
	const unknown =
		data.unavailable.length > 0
		|| data.documents.some((document) => malformedResponse(document) || (document.parsed.fields.kind === "question" && !questionFrom(document)));
	const questions = data.documents.flatMap((document) => {
		const question = questionFrom(document);
		return question && question.question.item === result.parsed.fields.id ? [question] : [];
	});
	const read = readResponses(Effect.succeed(data));
	const readings = yield* Effect.forEach(questions, (question) => Effect.result(read(question.id)));
	if (unknown || readings.some((reading) => reading._tag === "Failure")) {
		return '<section id="result-feedback"><h2>Recorded human feedback</h2><p role="status">Response history is unknown or ambiguous. Unreadable records do not establish that no feedback exists. Read the source files before relying on it.</p></section>';
	}
	const current = revisionOf((result.parsed.raw ?? "") + result.parsed.body);
	const records = readings.flatMap((reading) =>
		reading._tag === "Success" ? reading.success.responses.map((response) => ({ question: reading.success.question, response })) : [],
	);
	records.sort((a, b) => b.response.response.recordedAt - a.response.response.recordedAt || a.response.id.localeCompare(b.response.id));
	const bodies = yield* Effect.forEach(records, ({ question, response }) =>
		Effect.gen(function* () {
			const matching = question.question.reviewedRevision === current && question.question.source === result.file;
			const responseFile = data.model.ids.get(response.id)?.[0]?.file ?? `responses/${response.id}.md`;
			const questionFile = data.model.ids.get(question.id)?.[0]?.file ?? `responses/${question.id}.md`;
			const body = yield* renderMarkdown(response.body, { file: responseFile, safe: true });
			const selected = response.response.answers?.map((answer) => `${answer.prompt}: ${answer.selected.join(", ") || "text only"}`).join("; ");
			return `<article id="${escapeHtml(response.id)}"><h3>${escapeHtml(response.response.author)} · ${escapeHtml(response.response.type)}</h3><p><b>${matching ? "Feedback on this exact result revision" : "Earlier or moved result context — does not apply automatically to this revision"}</b></p><p>Reviewed source: ${escapeHtml(question.question.source)} · SHA-256 <code>${question.question.reviewedRevision}</code></p>${selected ? `<p>Recorded option IDs: ${escapeHtml(selected)}. Labels and reasoning are recorded below.</p>` : ""}${response.response.supersedes ? `<p>Explicitly supersedes <a href="${fileUrl(data.model.ids.get(response.response.supersedes)?.[0]?.file ?? `responses/${response.response.supersedes}.md`)}">${escapeHtml(response.response.supersedes)}</a>.</p>` : ""}${body}<p><a href="${fileUrl(responseFile)}">Response source</a> · <a href="${fileUrl(questionFile)}">Registered reviewed context</a></p><details><summary>Exact reviewed result source</summary><pre>${escapeHtml(question.context)}</pre></details></article>`;
		}),
	);
	return `<section id="result-feedback"><h2>Recorded human feedback</h2><p>Human direction is pinned to its reviewed report. Option IDs and authored acceptance text are not a computed verified-acceptance state. Completing a run or receiving feedback does not change work status.</p>${bodies.join("") || "<p>No readable response is recorded for this result.</p>"}</section>`;
});
