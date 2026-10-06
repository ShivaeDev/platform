import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { fileUrl } from "#files/url.ts";
import { respond } from "#http/respond.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { responseService } from "./service.ts";

export function responsePage(
	service: Effect.Success<ReturnType<typeof responseService>>,
	changes: Changes,
	home: string | undefined,
	enabled: boolean,
) {
	return Effect.fn("WorkBoard.responsePage")(function* (request: HttpServerRequest.HttpServerRequest) {
		const params = new URL(request.url, "http://127.0.0.1").searchParams;
		const item = params.get("item") ?? "";
		const requestId = params.get("request") ?? "";
		const files = yield* changes.files;
		function layout(body: string, status = 200) {
			return respond(shell("Respond", navHtml(files, "", home), body, changes.realRoot, false, undefined, "response"), "text/html", status);
		}
		return yield* service.locate(item, requestId).pipe(
			Effect.flatMap((question) =>
				Effect.map(
					service
						.read(question.id)
						.pipe(Effect.catch((error) => (error.code === "Missing" ? Effect.succeed({ responses: [] }) : Effect.fail(error)))),
					(recorded) => {
						const q = question;
						const body = `<section class="response-panel"><h1>Respond to ${escapeHtml(item)} / ${escapeHtml(requestId)}</h1><p>${escapeHtml(q.reason)}</p><p><a href="${fileUrl(q.source)}">Source: ${escapeHtml(q.source)}</a> · Reviewed SHA-256: <code>${q.reviewedRevision}</code></p><p>Saved replies are authored feedback. They do not close the request or establish acceptance.</p><details><summary>Exact source being reviewed</summary><pre>${escapeHtml(question.context)}</pre></details><form id="response-form" data-question="${question.id}" data-writable="${enabled}" data-item="${escapeHtml(item)}" data-request="${escapeHtml(requestId)}" data-revision="${q.reviewedRevision}"><label>Local author label <input name="author" maxlength="200" required></label><label>Response kind <select name="type"><option value="answer">Answer (including no)</option><option value="clarify">Ask back / clarify</option><option value="not_now">Not now</option></select></label><label>Your response <textarea name="body" rows="8" maxlength="32768" required></textarea></label><p>Drafts stay in this browser for 30 days after the last edit, with a 2 MiB workspace limit. Saved responses are Markdown files in responses/.</p><button id="response-preview" type="button" disabled>Preview Markdown</button><pre id="response-preview-content" hidden></pre><button id="response-submit" type="submit" disabled>Record response</button><button id="response-clear" type="button" disabled>Clear workspace drafts</button><p id="response-status" role="status">${enabled ? "JavaScript is required to record a response." : "Read-only mode. Restart with --responses to explicitly enable local writes."}</p></form><section id="response-history"><h2>Recorded responses</h2>${recorded.responses.map((record) => `<article><p><a href="/responses/${record.id}.md">${escapeHtml(record.response.author)} · ${escapeHtml(record.response.type)}</a></p><pre>${escapeHtml(record.body)}</pre></article>`).join("") || "<p>No response is recorded for this source revision.</p>"}</section></section>`;
						return layout(body);
					},
				),
			),
			Effect.catch((error) => Effect.succeed(layout(`<h1>Response unavailable</h1><p>${escapeHtml(error.message)}</p>`, 409))),
		);
	});
}
