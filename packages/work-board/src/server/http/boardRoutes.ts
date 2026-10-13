import { Effect, type FileSystem, type Path, type Scope } from "effect";
import { HttpRouter, type HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import { loopbackOnly } from "@shivaedev/platform/rpc-server/local.ts";
import type { Diagnostics } from "#diagnostics/source.ts";
import type { BoardOptions } from "#server/board.ts";
import type { boardRuntime } from "#server/boardRuntime.ts";
import type { HandoffsService } from "#server/handoffs/Service.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import type { Highlighter } from "#server/render/Highlighter.ts";
import type { Responses } from "#server/responses/service.ts";
import { ASSET_HANDLERS, MERMAID_ROUTE, mermaidFile } from "./assets.ts";
import { attachment } from "./attachment.ts";
import { identity } from "./identity.ts";
import { inbox } from "./inbox.ts";
import { overview } from "./overview.ts";
import { page } from "./page.ts";
import { respond } from "./respond.ts";
import { work } from "./work.ts";

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
					loopbackOnly((request) => Effect.provideContext(handler(request), context)),
				);
			}
			yield* serve("/_board/attachment/*", attachment(options.root, changes.realRoot));
			const inboxPage = inbox(index, changes, home);
			yield* serve("/_board/inbox", inboxPage);
			const workPage = work(index, changes, home);
			const overviewPage = overview(index, changes, home);
			yield* serve("/_board/work", workPage);
			yield* serve("/_board/overview", overviewPage);
			for (const [route, asset] of ASSET_HANDLERS) {
				yield* serve(route, asset);
			}
			yield* serve(MERMAID_ROUTE, mermaidFile(mermaid));
			for (const view of ["changes", "diagnostics", "start", "respond", "handoff", "result"] as const) {
				yield* serve(`/_board/${view}`, () =>
					Effect.gen(function* () {
						const snapshot = yield* index;
						const nav = navHtml(yield* changes.files, "", home, snapshot);
						return respond(shell(view, nav, "", changes.realRoot, false, undefined, view === "respond" ? "response" : view, snapshot), "text/html");
					}),
				);
			}
			const pages = page({ home, root: options.root, writable: options.responses === true }, changes, index);
			const items = identity(index, pages, changes, home);
			yield* serve("/_board/item/*", items);
			yield* serve("/", pages);
			yield* serve("/*", pages);
		}),
	);
}
