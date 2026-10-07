import { Context, Effect, FileSystem, Layer, Path, type PlatformError, type Scope } from "effect";
import { HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import { watchChanges } from "#files/changes.ts";
import { type HomeMissing, homeIn } from "#files/home.ts";
import { handoffPage } from "#handoffs/page.ts";
import { handoffService } from "#handoffs/service.ts";
import { ASSETS, MERMAID_ROUTE, type MermaidMissing, mermaidFile, mermaidRoot, NATIVE_ROUTE, nativeAsset } from "#http/assets.ts";
import { attachment } from "#http/attachment.ts";
import { events } from "#http/events.ts";
import { changesPage, history } from "#http/history.ts";
import { identity } from "#http/identity.ts";
import { loopbackOnly } from "#http/loopback.ts";
import { overview } from "#http/overview.ts";
import { page } from "#http/page.ts";
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
			const index = yield* searchSnapshot(options.root, home, changes);
			yield* serve("/_board/search", search(index));
			const startPage = start(changes, home);
			yield* serve("/_board/start", startPage);
			const workPage = work(index, changes, home);
			const result = resultPage(index, changes, home);
			yield* serve("/_board/result", result);
			const overviewPage = overview(index, changes, home);
			const historyPage = changesPage(changes, home);
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
			const replyPage = responsePage(responses, changes, home, options.responses === true);
			yield* serve("/_board/respond", replyPage);
			const handoffs = yield* handoffService({
				changes,
				enabled: options.responses === true,
				index: Effect.provideContext(index, context),
				root: options.root,
			});
			const handoff = handoffPage(handoffs, changes, home, options.responses === true);
			yield* serve("/_board/handoff", handoff);
			const pages = page({ home, root: options.root }, changes, index);
			const items = identity(index, pages, changes, home);
			yield* serve("/_board/item/*", items);
			function readPage(url: string) {
				const request = HttpServerRequest.fromWeb(new Request(`http://127.0.0.1${url}`));
				const pathname = new URL(url, "http://127.0.0.1").pathname;
				let selected: ReturnType<typeof pages>;
				switch (pathname) {
					case "/_board/result":
						selected = result(request);
						break;
					case "/_board/handoff":
						selected = handoff(request);
						break;
					case "/_board/respond":
						selected = replyPage(request);
						break;
					case "/_board/start":
						selected = startPage();
						break;
					case "/_board/work":
						selected = workPage(request);
						break;
					case "/_board/overview":
						selected = overviewPage();
						break;
					case "/_board/changes":
						selected = historyPage();
						break;
					default:
						selected = pathname.startsWith("/_board/item/") ? items(request) : pages(request);
				}
				return Effect.provideContext(selected, context);
			}
			const rpc = yield* server({ changes, handoffs, home, index: Effect.provideContext(index, context), page: readPage, responses });
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

export const boardLayer = (options: BoardOptions): Layer.Layer<never, BoardError, BoardServices> =>
	routes(options).pipe(Layer.provide(Highlighter.layer));
