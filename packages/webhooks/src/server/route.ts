import { Cause, type Config, type Context, Effect, Layer, Predicate, type Redacted } from "effect";
import { HttpRouter, type HttpServerRequest, HttpServerRespondable, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { SqlClient } from "effect/sql";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import { readBoundedBody } from "@shivaedev/http/server/boundedBody.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { receive } from "#server/internal/receive.ts";
import type { WebhookSource } from "#server/registration.ts";

export interface WebhookRouteOptions<TJobs, R, E = never> {
	readonly basePath: `/${string}`;
	readonly jobs: Context.Key<TJobs, PgBossService>;
	readonly sources: Readonly<Record<string, WebhookSource<R, E>>>;
}

type SourceServices<T> = T extends WebhookSource<infer R, unknown> ? R : never;
type RouteLayer<TJobs, R> = Layer.Layer<never, Config.ConfigError, HttpRouter.HttpRouter | TJobs | R | SqlClient.SqlClient>;

function webhookBody(request: HttpServerRequest.HttpServerRequest) {
	return readBoundedBody(request).pipe(
		Effect.map((body) => new Uint8Array(body)),
		Effect.catchTag("RequestBodyTooLarge", () => Effect.succeed(HttpServerResponse.empty({ status: HttpStatus.fromLiteral("PayloadTooLarge") }))),
	);
}

function receiptFailure(error: unknown) {
	const response = HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
	const cause = redactDiagnosticCause(Cause.fail(error));
	const responseCause = Cause.map(cause, (failure) =>
		Object.assign(new Error("Webhook receipt failed", { cause: failure }), {
			[HttpServerRespondable.symbol]: () => Effect.succeed(response),
		}),
	);
	return Effect.logError("Webhook receipt failed", cause).pipe(
		Effect.annotateLogs({ errorTag: Predicate.hasProperty(error, "_tag") ? error._tag : "Unknown" }),
		Effect.andThen(Effect.failCause(responseCause)),
	);
}

export function webhookRoute<TJobs, R, E = never>(options: WebhookRouteOptions<TJobs, R, E>): RouteLayer<TJobs, R>;
export function webhookRoute<TJobs, const TSources extends Readonly<Record<string, WebhookSource<unknown, unknown>>>>(
	options: Pick<WebhookRouteOptions<TJobs, never>, "basePath" | "jobs"> & { readonly sources: TSources },
): RouteLayer<TJobs, SourceServices<TSources[keyof TSources]>>;
export function webhookRoute<TJobs, R, E = never>(options: WebhookRouteOptions<TJobs, R, E>) {
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
					const body = yield* webhookBody(request);
					if (HttpServerResponse.isHttpServerResponse(body)) {
						return body;
					}
					return yield* receive(name, source, key, body, request.headers, jobs).pipe(Effect.scoped, Effect.provideContext(context));
				}).pipe(Effect.catch(receiptFailure)),
			);
		}),
	);
}
