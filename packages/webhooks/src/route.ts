import { Cause, type Context, Effect, Layer, type Redacted } from "effect";
import { HttpRouter, HttpServerRespondable, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { SqlClient } from "effect/sql";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
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
						return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("NotFound") });
					}
					const body = new Uint8Array(yield* readBoundedBody(request));
					return yield* receive(name, source, key, body, request.headers, jobs).pipe(Effect.provideContext(context));
				}).pipe(
					Effect.catchTag("RequestBodyTooLarge", () =>
						Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("PayloadTooLarge") })),
					),
					Effect.catchTag("WebhookUnauthorized", () => Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("Unauthorized") }))),
					Effect.catchTag("SchemaError", () => Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("BadRequest") }))),
					Effect.catch((error) => {
						const response = HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
						// Preserve the failure for HTTP tracing without attaching the request's credentials to a synthetic 503 error.
						const cause = redactDiagnosticCause(Cause.fail(Object.assign(error, { [HttpServerRespondable.symbol]: () => Effect.succeed(response) })));
						return Effect.logError("Webhook receipt failed", cause).pipe(
							Effect.annotateLogs({ errorTag: error._tag }),
							Effect.andThen(Effect.failCause(cause)),
						);
					}),
				),
			);
		}),
	);
}
