import { type Context, Effect, Layer, type Redacted } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import type { SqlClient } from "effect/sql";
import { readBoundedBody } from "@shivaedev/http/server/boundedBody.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { receive } from "#internal/receive.ts";
import type { WebhookSource } from "#registration.ts";

export interface WebhookRouteOptions<TJobs, R> {
	readonly basePath: `/${string}`;
	readonly jobs: Context.Key<TJobs, PgBossService>;
	readonly sources: Readonly<Record<string, WebhookSource<R>>>;
}

export function webhookRoute<TJobs, R>(options: WebhookRouteOptions<TJobs, R>) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const context = yield* Effect.context<TJobs | R | SqlClient.SqlClient>();
			const jobs = yield* options.jobs;
			const keys = new Map<string, Redacted.Redacted<string>>();
			for (const [name, source] of Object.entries(options.sources)) {
				keys.set(name, yield* source.key);
			}
			return HttpRouter.add("POST", `/${options.basePath.replace(/^\/|\/$/gu, "")}/:source`, (request) =>
				Effect.gen(function* () {
					const { params } = yield* HttpRouter.RouteContext;
					const name = params.source ?? "";
					const source = Object.hasOwn(options.sources, name) ? options.sources[name] : undefined;
					const key = keys.get(name);
					if (source === undefined || key === undefined) {
						return HttpServerResponse.empty({ status: 404 });
					}
					const body = new Uint8Array(yield* readBoundedBody(request));
					return yield* receive(name, source, key, body, request.headers, jobs).pipe(Effect.provideContext(context));
				}).pipe(
					Effect.catchTag("RequestBodyTooLarge", () => Effect.succeed(HttpServerResponse.empty({ status: 413 }))),
					Effect.catchTag("WebhookUnauthorized", () => Effect.succeed(HttpServerResponse.empty({ status: 401 }))),
					Effect.catchTag("SchemaError", () => Effect.succeed(HttpServerResponse.empty({ status: 400 }))),
					Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 503 }))),
				),
			);
		}).pipe(Effect.orDie),
	);
}
