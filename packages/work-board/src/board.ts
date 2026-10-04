import { Effect, type FileSystem, Layer, type Path } from "effect";
import { HttpRouter, type HttpServerRequest, type HttpServerResponse } from "effect/unstable/http";
import { watchChanges } from "#files/changes.ts";
import { homeIn } from "#files/home.ts";
import { ASSETS, MERMAID_ROUTE, mermaidFile, mermaidRoot } from "#http/assets.ts";
import { events } from "#http/events.ts";
import { loopbackOnly } from "#http/loopback.ts";
import { page } from "#http/page.ts";
import { respond } from "#http/respond.ts";
import { Highlighter } from "#render/highlighter.ts";

export interface BoardOptions {
	readonly home?: string | undefined;
	readonly root: string;
}

type Services = Highlighter | FileSystem.FileSystem | Path.Path;
type Handler<E> = (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, Services>;

const routes = (options: BoardOptions) =>
	HttpRouter.use((router) =>
		Effect.gen(function* () {
			const home = yield* homeIn(options.root, options.home);
			const mermaid = yield* mermaidRoot();
			const changes = yield* watchChanges(options.root);
			const context = yield* Effect.context<Services>();
			const serve = <E>(route: HttpRouter.PathInput, handler: Handler<E>) =>
				router.add(
					"GET",
					route,
					loopbackOnly((request) => Effect.provideContext(handler(request), context)),
				);
			yield* serve("/events", events(changes));
			for (const [route, body, contentType] of ASSETS) {
				yield* serve(route, () => Effect.succeed(respond(body, contentType)));
			}
			yield* serve(MERMAID_ROUTE, mermaidFile(mermaid));
			const pages = page({ home, root: options.root }, changes);
			yield* serve("/", pages);
			yield* serve("/*", pages);
		}),
	);

export const boardLayer = (options: BoardOptions) => routes(options).pipe(Layer.provide(Highlighter.layer));
