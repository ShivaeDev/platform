import { Context, Effect, FileSystem, Layer, Path, type PlatformError, type Scope } from "effect";
import { HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import type { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { loopbackOnly } from "@shivaedev/platform/rpc-server/local.ts";
import { Diagnostics, DiagnosticsSources } from "#diagnostics/source.ts";
import type { RenderFailed } from "#render/failed.ts";
import { boardServices } from "#server/boardServices.ts";
import { daemonDiagnostics } from "#server/diagnostics/daemon.ts";
import { diagnosticsPage } from "#server/diagnostics/page.ts";
import { readDocument } from "#server/document/read.ts";
import { watchChanges } from "#server/files/changes.ts";
import { type HomeMissing, homeIn } from "#server/files/home.ts";
import { handoffPage } from "#server/handoffs/page.ts";
import type { HandoffsService } from "#server/handoffs/Service.ts";
import { ASSET_HANDLERS, checkBrowserAssets, MERMAID_ROUTE, type MermaidMissing, mermaidFile, mermaidRoot } from "#server/http/assets.ts";
import { attachment } from "#server/http/attachment.ts";
import { changesPage } from "#server/http/changesPage.ts";
import { identity } from "#server/http/identity.ts";
import { inbox } from "#server/http/inbox.ts";
import { overview } from "#server/http/overview.ts";
import { page } from "#server/http/page.ts";
import { readPage } from "#server/http/readPage.ts";
import { start } from "#server/http/start.ts";
import { work } from "#server/http/work.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { responsePage } from "#server/responses/page.ts";
import type { Responses } from "#server/responses/service.ts";
import { resultPage } from "#server/results/page.ts";
import { server } from "#server/rpc/transport.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";

export interface BoardOptions {
	readonly fleetPort?: number;
	readonly home?: string | undefined;
	readonly maintainer?: string | undefined;
	readonly responses?: boolean;
	readonly root: string;
}

type Services = Highlighter | Responses | HandoffsService | Diagnostics | FileSystem.FileSystem | Path.Path;
type Handler<E> = (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, Services | Scope.Scope>;

function routes(options: BoardOptions) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const home = yield* homeIn(options.root, options.home);
			const mermaid = yield* mermaidRoot();
			yield* checkBrowserAssets();
			const changes = yield* watchChanges(options.root);
			const platform = (yield* Effect.context<Highlighter | FileSystem.FileSystem | Path.Path>()).pipe(
				Context.pick(Highlighter, FileSystem.FileSystem, Path.Path),
			);
			const index = yield* searchSnapshot(options.root, home, changes, options.maintainer);
			const provided = yield* Effect.serviceOption(DiagnosticsSources);
			const services = yield* Layer.build(
				boardServices(
					{ changes, enabled: options.responses === true, index: Effect.provideContext(index, platform), root: options.root },
					provided._tag === "Some" ? { _tag: "Sources", sources: provided.value } : { _tag: "Read", read: daemonDiagnostics(options.fleetPort) },
				),
			);
			const context = Context.merge(platform, services);
			function serve<E>(route: HttpRouter.PathInput, handler: Handler<E>, method: "GET" | "POST" = "GET") {
				return router.add(
					method,
					route,
					loopbackOnly((request) => Effect.provideContext(handler(request), context)),
				);
			}
			yield* serve("/_board/attachment/*", attachment(options.root, changes.realRoot));
			const healthPage = diagnosticsPage(
				Effect.flatMap(Diagnostics, (service) => service.read()).pipe(Effect.provideContext(context)),
				changes,
				home,
				index,
			);
			yield* serve("/_board/diagnostics", () => healthPage);
			const inboxPage = inbox(index, changes, home);
			yield* serve("/_board/inbox", inboxPage);
			const startPage = start(changes, home, index);
			yield* serve("/_board/start", startPage);
			const workPage = work(index, changes, home);
			const result = resultPage(index, changes, home);
			yield* serve("/_board/result", result);
			const overviewPage = overview(index, changes, home);
			const historyPage = changesPage(changes, home, index);
			yield* serve("/_board/work", workPage);
			yield* serve("/_board/overview", overviewPage);
			yield* serve("/_board/changes", historyPage);
			for (const [route, asset] of ASSET_HANDLERS) {
				yield* serve(route, asset);
			}
			yield* serve(MERMAID_ROUTE, mermaidFile(mermaid));
			const replyPage = responsePage(changes, home, options.responses === true, index);
			yield* serve("/_board/respond", replyPage);
			const handoff = handoffPage(changes, home, options.responses === true, index);
			yield* serve("/_board/handoff", handoff);
			const pages = page({ home, root: options.root, writable: options.responses === true }, changes, index);
			const items = identity(index, pages, changes, home);
			yield* serve("/_board/item/*", items);
			const reading = readPage<PlatformError.PlatformError, Services>(
				{
					"/_board/changes": () => historyPage(),
					"/_board/diagnostics": () => healthPage,
					"/_board/handoff": handoff,
					"/_board/inbox": () => inboxPage(),
					"/_board/overview": () => overviewPage(),
					"/_board/respond": replyPage,
					"/_board/result": result,
					"/_board/start": () => startPage(),
					"/_board/work": workPage,
				},
				(request) => (new URL(request.url, "http://127.0.0.1").pathname.startsWith("/_board/item/") ? items(request) : pages(request)),
			);
			const rpc = yield* server({
				changes,
				document: (url) =>
					Effect.provideContext(
						readDocument({
							changes,
							home,
							index: Effect.provideContext(index, context),
							root: options.root,
							writable: options.responses === true,
						})(url),
						context,
					),
				home,
				index: Effect.provideContext(index, context),
				page: (url) => Effect.provideContext(reading(url), context),
			}).pipe(Effect.provideContext(context));
			yield* serve("/_board/rpc", (request) => rpc.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request)), "POST");
			yield* serve("/", pages);
			yield* serve("/*", pages);
		}),
	);
}

type BoardError = InternalServerError | HomeMissing | MermaidMissing | PlatformError.PlatformError | RenderFailed;
type BoardServices =
	| FileSystem.FileSystem
	| HttpRouter.HttpRouter
	| Path.Path
	| HttpRouter.Request<"Error", InternalServerError | PlatformError.PlatformError>;

export function boardLayer(options: BoardOptions): Layer.Layer<never, BoardError, BoardServices> {
	return routes(options).pipe(Layer.provide(Highlighter.layer));
}
