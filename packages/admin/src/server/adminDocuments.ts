import { Effect } from "effect";
import type { HttpServerRequest } from "effect/http";
import { HttpRouter, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { permissionRoute } from "@shivaedev/identity/server/permissions.ts";
import { matchAdminRoute } from "#adapters/matchAdminRoute.ts";
import type { AnyAdminRegistry } from "#registry.ts";

export function adminDocuments<E, R>(
	registry: AnyAdminRegistry,
	handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	const routes = registry.pages.map((page) => page.route);
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			yield* router.add("GET", "/admin/*", (request) => {
				const path = new URL(request.url, "http://localhost").pathname;
				const route = matchAdminRoute(routes, path);
				return route === undefined
					? Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("NotFound") }))
					: permissionRoute(route.permission)(handler)(request);
			});
		}),
	);
}
