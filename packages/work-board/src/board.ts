import { Context, Effect, FileSystem, Layer, Path, type PlatformError, type Scope } from "effect";
import { HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import { codexLimits } from "#diagnostics/codexLimits.ts";
import { fleetHealth } from "#diagnostics/fleetHealth.ts";
import { githubLimits } from "#diagnostics/githubLimits.ts";
import { diagnosticsPage } from "#diagnostics/page.ts";
import { DiagnosticsSources, diagnostics } from "#diagnostics/source.ts";
import { watchChanges } from "#files/changes.ts";
import { type HomeMissing, homeIn } from "#files/home.ts";
import { handoffPage } from "#handoffs/page.ts";
import { handoffService } from "#handoffs/service.ts";
import { ASSETS, MERMAID_ROUTE, type MermaidMissing, mermaidFile, mermaidRoot, NATIVE_ROUTE, nativeAsset } from "#http/assets.ts";
import { attachment } from "#http/attachment.ts";
import { events } from "#http/events.ts";
import { changesPage, history } from "#http/history.ts";
import { identity } from "#http/identity.ts";
import { inbox } from "#http/inbox.ts";
import { loopbackOnly } from "#http/loopback.ts";
import { overview } from "#http/overview.ts";
import { page } from "#http/page.ts";
import { readPage } from "#http/readPage.ts";
import { respond } from "#http/respond.ts";
import { sameOrigin } from "#http/sameOrigin.ts";
import { search } from "#http/search.ts";
import { start } from "#http/start.ts";
import { work } from "#http/work.ts";
import type { RenderFailed } from "#render/failed.ts";
import { Highlighter } from "#render/highlighter.ts";
import { responsePage } from "#responses/page.ts";
import { responseService } from "#responses/service.ts";
import { resultPage } from "#results/page.ts";
import { server } from "#rpc/server.ts";
import { searchSnapshot } from "#search/snapshot.ts";

export interface BoardOptions {
	readonly home?: string | undefined;
	readonly maintainer?: string | undefined;
	readonly responses?: boolean;
	readonly root: string;
}

type Services = Highlighter | FileSystem.FileSystem | Path.Path;
type Handler<E> = (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, Services | Scope.Scope>;

function routes(options: BoardOptions) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const home = yield* homeIn(options.root, options.home);
			const mermaid = yield* mermaidRoot();
			const changes = yield* watchChanges(options.root);
			const context = (yield* Effect.context<Services>()).pipe(Context.pick(Highlighter, FileSystem.FileSystem, Path.Path));
			function serve<E>(route: HttpRouter.PathInput, handler: Handler<E>, method: "GET" | "POST" = "GET") {
				return router.add(
					method,
					route,
					loopbackOnly((request) => Effect.provideContext(handler(request), context)),
				);
			}
			yield* serve("/events", events(changes));
			yield* serve("/_board/attachment/*", attachment(options.root, changes.realRoot));
			const index = yield* searchSnapshot(options.root, home, changes, options.maintainer);
			const provided = yield* Effect.serviceOption(DiagnosticsSources);
			const sources = provided._tag === "Some" ? provided.value : { codex: codexLimits(), fleet: fleetHealth(options.root), github: githubLimits() };
			const healthPage = diagnosticsPage(yield* diagnostics(sources), changes, home, index);
			yield* serve("/_board/diagnostics", () => healthPage);
			yield* serve("/_board/search", search(index));
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
			yield* serve("/_board/history", history(index), "POST");
			for (const [route, body, contentType] of ASSETS) {
				yield* serve(route, () => Effect.succeed(respond(body, contentType)));
			}
			yield* serve(MERMAID_ROUTE, mermaidFile(mermaid));
			yield* serve(NATIVE_ROUTE, nativeAsset);
			const responses = yield* responseService({
				changes,
				enabled: options.responses === true,
				index: Effect.provideContext(index, context),
				root: options.root,
			});
			const replyPage = responsePage(responses, changes, home, options.responses === true, index);
			yield* serve("/_board/respond", replyPage);
			const handoffs = yield* handoffService({
				changes,
				enabled: options.responses === true,
				index: Effect.provideContext(index, context),
				root: options.root,
			});
			const handoff = handoffPage(handoffs, changes, home, options.responses === true, index);
			yield* serve("/_board/handoff", handoff);
			const pages = page({ home, responses, root: options.root, writable: options.responses === true }, changes, index);
			const items = identity(index, pages, changes, home);
			yield* serve("/_board/item/*", items);
			const reading = readPage(
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
				handoffs,
				home,
				index: Effect.provideContext(index, context),
				page: (url) => Effect.provideContext(reading(url), context),
				responses,
			});
			yield* serve(
				"/_board/rpc",
				(request) =>
					sameOrigin(request) && (options.responses !== true || request.headers["content-type"]?.split(";")[0] === "application/ndjson")
						? rpc.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request))
						: Effect.succeed(respond("Local same-origin requests only", "text/plain", 403)),
				"POST",
			);
			yield* serve("/", pages);
			yield* serve("/*", pages);
		}),
	);
}

type BoardError = HomeMissing | MermaidMissing | PlatformError.PlatformError | RenderFailed;
type BoardServices = FileSystem.FileSystem | HttpRouter.HttpRouter | Path.Path | HttpRouter.Request<"Error", PlatformError.PlatformError>;

export function boardLayer(options: BoardOptions): Layer.Layer<never, BoardError, BoardServices> {
	return routes(options).pipe(Layer.provide(Highlighter.layer));
}
