import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { respond } from "#http/respond.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import { composerHtml } from "./composerHtml.ts";
import type { responseService } from "./service.ts";

export function responsePage(
	service: Effect.Success<ReturnType<typeof responseService>>,
	changes: Changes,
	home: string | undefined,
	enabled: boolean,
) {
	return Effect.fn("WorkBoard.responsePage")(function* (request: HttpServerRequest.HttpServerRequest) {
		const params = new URL(request.url, "http://127.0.0.1").searchParams;
		const files = yield* changes.files;
		function layout(body: string, status = 200) {
			return respond(shell("Respond", navHtml(files, "", home), body, changes.realRoot, false, undefined, "response"), "text/html", status);
		}
		return yield* Effect.gen(function* () {
			const question = yield* service.locate(params.get("item") ?? "", params.get("request") ?? "");
			yield* service.read(question.id).pipe(Effect.catch((error) => (error.code === "Missing" ? Effect.void : Effect.fail(error))));
			const records = yield* service.history(question);
			return layout(yield* composerHtml(question, records, enabled));
		}).pipe(Effect.catch((error) => Effect.succeed(layout(`<h1>Response unavailable</h1><p>${escapeHtml(String(error))}</p>`, 409))));
	});
}
