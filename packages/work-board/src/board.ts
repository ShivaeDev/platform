import { Context, Effect, FileSystem, Layer, Path, type PlatformError, type Scope } from "effect";
import { HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import type { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { loopbackOnly } from "@shivaedev/platform/rpc-server/local.ts";
import { boardServices } from "#boardServices.ts";
import { daemonDiagnostics } from "#diagnostics/daemon.ts";
import { diagnosticsPage } from "#diagnostics/page.ts";
import { Diagnostics, DiagnosticsSources } from "#diagnostics/source.ts";
import { readDocument } from "#document/read.ts";
import { watchChanges } from "#files/changes.ts";
import { type HomeMissing, homeIn } from "#files/home.ts";
import { handoffPage } from "#handoffs/page.ts";
import type { HandoffsService } from "#handoffs/Service.ts";
import { ASSET_HANDLERS, checkBrowserAssets, MERMAID_ROUTE, type MermaidMissing, mermaidFile, mermaidRoot } from "#http/assets.ts";
import { attachment } from "#http/attachment.ts";
import { changesPage } from "#http/changesPage.ts";
import { identity } from "#http/identity.ts";
import { inbox } from "#http/inbox.ts";
import { overview } from "#http/overview.ts";
import { page } from "#http/page.ts";
import { readPage } from "#http/readPage.ts";
import { start } from "#http/start.ts";
import { work } from "#http/work.ts";
import type { RenderFailed } from "#render/failed.ts";
import { Highlighter } from "#render/Highlighter.ts";
import { responsePage } from "#responses/page.ts";
import type { Responses } from "#responses/service.ts";
import { resultPage } from "#results/page.ts";
import { server } from "#rpc/server.ts";
import { searchSnapshot } from "#search/snapshot.ts";

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
