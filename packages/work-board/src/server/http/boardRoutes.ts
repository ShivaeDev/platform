import { Effect, type FileSystem, type Path, type Scope } from "effect";
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { loopbackOnly } from "@shivaedev/identity/server/local.ts";
import type { Diagnostics } from "#diagnostics/source.ts";
import { responseUrl, resultUrl } from "#responses/url.ts";
import type { BoardOptions } from "#server/board.ts";
import type { boardRuntime } from "#server/boardRuntime.ts";
import type { HandoffsService } from "#server/handoffs/Service.ts";
import { shell } from "#server/page/shell.ts";
import { Responses } from "#server/Responses.ts";
import type { Highlighter } from "#server/render/Highlighter.ts";
import { ASSET_HANDLERS, MERMAID_ROUTE, mermaidFile } from "./assets.ts";
import { attachment } from "./attachment.ts";
import { encodedBodies, encodeResponse } from "./encoding.ts";
import { identity } from "./identity.ts";
import { page } from "./page.ts";
import { respond } from "./respond.ts";

// ETags hash the uncompressed bytes, so every board in the process can share one compressed copy of each asset.
const encoded = encodedBodies();

type Services = Highlighter | Responses | HandoffsService | Diagnostics | FileSystem.FileSystem | Path.Path;
type Handler<E> = (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, Services | Scope.Scope>;

export function boardRoutes(options: BoardOptions, runtime: Effect.Success<ReturnType<typeof boardRuntime>>) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const { changes, context, home, index, mermaid } = runtime;
			function serve<E>(route: HttpRouter.PathInput, handler: Handler<E>) {
				return router.add(
					"GET",
					route,
					loopbackOnly((request) =>
						Effect.provideContext(handler(request), context).pipe(Effect.flatMap((response) => encodeResponse(request, response, encoded))),
					),
				);
			}
			yield* serve("/_board/attachment/*", attachment(options.root, changes.realRoot));
			for (const [route, target] of [
				["overview", "/"],
				["inbox", "/"],
				["changes", "/_board/library?view=recently-changed"],
				["diagnostics", "/_board/system"],
			] as const) {
				yield* serve(`/_board/${route}`, () => Effect.succeed(HttpServerResponse.redirect(target)));
			}
			for (const [route, asset] of ASSET_HANDLERS) {
				yield* serve(route, asset);
			}
			yield* serve(MERMAID_ROUTE, mermaidFile(mermaid));
			yield* serve("/_board/respond", (request) =>
				Effect.gen(function* () {
					const params = new URL(request.url, "http://127.0.0.1").searchParams;
					const service = yield* Responses;
					const preview = yield* service.locate(params.get("item") ?? "", params.get("request") ?? "");
					return HttpServerResponse.redirect(responseUrl(preview.item, preview.request));
				}).pipe(Effect.catch(() => Effect.succeed(respond("Response unavailable", "text/html", HttpStatus.fromLiteral("Conflict"))))),
			);
			yield* serve("/_board/result", (request) =>
				Effect.succeed(HttpServerResponse.redirect(resultUrl(new URL(request.url, "http://127.0.0.1").searchParams.get("item")))),
			);
			for (const view of ["system", "start", "handoff", "library", "goals", "work", "pull-requests"] as const) {
				yield* serve(`/_board/${view}`, () => Effect.succeed(respond(shell(view, changes.realRoot), "text/html")));
			}
			const pages = page({ home, root: options.root, writable: options.responses === true }, changes, index);
			const items = identity(index, pages, changes);
			yield* serve("/_board/item/*", items);
			yield* serve("/", pages);
			yield* serve("/*", pages);
		}),
	);
}
