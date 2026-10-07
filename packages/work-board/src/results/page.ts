import { Effect, type FileSystem, type Path, type PlatformError } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { fileUrl } from "#files/url.ts";
import { respond } from "#http/respond.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import { escapeHtml } from "#page/escape.ts";
import { metadataHtml } from "#page/metadata.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { Highlighter } from "#render/highlighter.ts";
import { renderMarkdown } from "#render/markdown.ts";
import { revisionOf } from "#responses/records.ts";
import { resultCriteria } from "#results/criteria.ts";
import { resultFeedback } from "#results/feedback.ts";
import type { Snapshot } from "#search/snapshot.ts";

function reviewActions(result: MetadataDocument) {
	const requests = result.parsed.fields.attention ?? [];
	const actions = requests
		.filter(
			(attention) => attention.kind === "review" && attention.state === "open" && requests.filter((other) => other.id === attention.id).length === 1,
		)
		.map(
			(attention) =>
				`<li><a href="/_board/respond?item=${encodeURIComponent(result.parsed.fields.id ?? "")}&amp;request=${encodeURIComponent(attention.id)}">Review ${escapeHtml(attention.id)}</a> — ${escapeHtml(attention.reason)}</li>`,
		);
	return `<section id="result-actions"><h2>Respond to this report</h2>${actions.length > 0 ? `<ul>${actions.join("")}</ul>` : "<p>No unique open review request is declared. The agent can add an explicit attention review and Markdown question packet with ordinary file editing. Work Board does not infer one from status.</p>"}</section>`;
}

export function resultPage(index: Effect.Effect<Snapshot, unknown, FileSystem.FileSystem | Path.Path>, changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.resultPage")(function* (
		request: HttpServerRequest.HttpServerRequest,
	): Effect.fn.Return<HttpServerResponse.HttpServerResponse, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path | Highlighter> {
		const item = new URL(request.url, "http://127.0.0.1").searchParams.get("item") ?? "";
		const files = yield* changes.files;
		function layout(body: string, status = 200) {
			return respond(shell("Result review", navHtml(files, "", home), body, changes.realRoot, false, undefined, "result"), "text/html", status);
		}
		return yield* Effect.gen(function* () {
			const data = yield* index;
			const matches = data.model.ids.get(item);
			const result = matches?.length === 1 ? matches[0] : undefined;
			if (result?.parsed.fields.kind !== "result" || data.unavailable.length > 0) {
				return layout(
					'<h1>Result unavailable</h1><p role="status">Choose one uniquely identified, readable result. Missing or ambiguous work is not accepted.</p>',
					409,
				);
			}
			const report = yield* renderMarkdown(result.parsed.body, { file: result.file, safe: true });
			const feedback = yield* resultFeedback(result, data);
			const revision = revisionOf((result.parsed.raw ?? "") + result.parsed.body);
			return layout(
				`<section class="response-panel"><h1>Review returned result · ${escapeHtml(item)}</h1><p>Result status (source): <b>${escapeHtml(result.parsed.fields.status ?? "Not recorded")}</b>. This is a supplied claim, not an execution receipt or work acceptance.</p><p>Current report SHA-256: <code>${revision}</code> · <a href="${fileUrl(result.file)}">Read source</a></p>${metadataHtml(result.parsed, result.file, data.model)}${reviewActions(result)}${resultCriteria(result, data.model)}<section id="result-report"><h2>Report, evidence and limitations</h2>${report}</section>${feedback}</section>`,
			);
		}).pipe(Effect.catch((error) => Effect.succeed(layout(`<h1>Result review unavailable</h1><p>${escapeHtml(String(error))}</p>`, 409))));
	});
}
