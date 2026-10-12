import { Effect, type FileSystem, type Path, type PlatformError } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { escapeHtml } from "#browser/escapeHtml.ts";
import type { Changes } from "#server/files/changes.ts";
import { handoffFormHtml, handoffHistoryHtml } from "#server/handoffs/html.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { respond } from "#server/http/respond.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import type { Highlighter } from "#server/render/Highlighter.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";

function unknownHistory(files: readonly string[]) {
	return files.length > 0
		? `<p role="status">Some handoff history is unavailable: ${files.map(escapeHtml).join(", ")}. Missing records do not establish that no receipt exists.</p>`
		: "";
}
export function handoffPage(changes: Changes, home: string | undefined, enabled: boolean, index?: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.handoffPage")(function* (
		request: HttpServerRequest.HttpServerRequest,
	): Effect.fn.Return<
		HttpServerResponse.HttpServerResponse,
		PlatformError.PlatformError,
		FileSystem.FileSystem | Path.Path | Highlighter | HandoffsService
	> {
		const service = yield* HandoffsService;
		const item = new URL(request.url, "http://127.0.0.1").searchParams.get("item") ?? "";
		const files = yield* changes.files;
		const snapshot = index ? yield* index : undefined;
		function layout(body: string, status = 200) {
			return respond(
				shell("Handoff", navHtml(files, "", home, snapshot), body, changes.realRoot, false, undefined, "handoff", snapshot),
				"text/html",
				status,
			);
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
