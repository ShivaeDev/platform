import { Effect, type FileSystem, type Path, type PlatformError } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { handoffFormHtml, handoffHistoryHtml } from "#handoffs/html.ts";
import type { handoffService } from "#handoffs/service.ts";
import { respond } from "#http/respond.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { Highlighter } from "#render/highlighter.ts";

function unknownHistory(files: readonly string[]) {
	return files.length > 0
		? `<p role="status">Some handoff history is unavailable: ${files.map(escapeHtml).join(", ")}. Missing records do not establish that no receipt exists.</p>`
		: "";
}
export function handoffPage(
	service: Effect.Success<ReturnType<typeof handoffService>>,
	changes: Changes,
	home: string | undefined,
	enabled: boolean,
) {
	return Effect.fn("WorkBoard.handoffPage")(function* (
		request: HttpServerRequest.HttpServerRequest,
	): Effect.fn.Return<HttpServerResponse.HttpServerResponse, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path | Highlighter> {
		const item = new URL(request.url, "http://127.0.0.1").searchParams.get("item") ?? "";
		const files = yield* changes.files;
		function layout(body: string, status = 200) {
			return respond(shell("Handoff", navHtml(files, "", home), body, changes.realRoot, false, undefined, "handoff"), "text/html", status);
		}
		return yield* Effect.gen(function* () {
			const source = yield* Effect.result(service.locate(item));
			const current = source._tag === "Success" ? source.success : undefined;
			const reading = yield* service.read(item);
			const history = yield* handoffHistoryHtml(reading.records, current);
			const form = current
				? yield* handoffFormHtml(current, enabled)
				: `<p role="status">Source unavailable: ${escapeHtml(String(source._tag === "Failure" ? source.failure : ""))}. Existing handoffs remain readable.</p>`;
			return layout(
				`<section class="response-panel"><h1>Agent handoff · ${escapeHtml(item)}</h1><p>Prepare a Markdown file, then copy a tiny prompt into your existing agent session. Sessions may poll or wait for human answers. Agents record receipt with ordinary file edits.</p>${form}<section id="handoff-history"><h2>Prepared handoffs</h2>${unknownHistory(reading.unknown)}${history.join("") || "<p>No readable handoff is recorded for this item.</p>"}</section></section>`,
				current || reading.records.length > 0 ? 200 : 409,
			);
		}).pipe(Effect.catch((error) => Effect.succeed(layout(`<h1>Handoff unavailable</h1><p>${escapeHtml(String(error))}</p>`, 409))));
	});
}
