import { Cache, Clock, Context, Effect, Exit, Layer, Option, type Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedJson } from "@shivaedev/http/body.ts";
import { type AppCredentials, appJwt } from "#appJwt.ts";
import { authenticatedRequest } from "#authenticatedRequest.ts";
import { GitHubAppError } from "#errors.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { rateLimits } from "#rateLimits.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export interface InstallationScope {
	readonly permissions?: Readonly<Record<string, "read" | "write" | "admin">>;
	readonly repositories?: readonly string[];
	readonly repositoryIds?: readonly number[];
}

export type GitHubAppOptions = AppCredentials &
	(
		| { readonly installationId: number; readonly scope?: InstallationScope }
		| { readonly owner: string; readonly repository: string; readonly scope?: InstallationScope }
		| { readonly installationId?: never; readonly owner?: never; readonly repository?: never; readonly scope?: never }
	);

const Installation = Schema.Struct({ id: Schema.Number });
const AccessToken = Schema.Struct({ expiresAt: Schema.DateFromString, token: Schema.RedactedFromValue(Schema.String) }).pipe(
	Schema.encodeKeys({ expiresAt: "expires_at" }),
);

export function githubApp(options: GitHubAppOptions) {
	return Layer.effectContext(
		Effect.gen(function* () {
			if (!("installationId" in options || "owner" in options)) {
				return Context.make(GitHubToken, Effect.map(appJwt(options), Option.some)).pipe(Context.add(TokenRefresh, undefined));
			}
			const client = yield* HttpClient.HttpClient;
			const { apiUrl } = yield* GitHubConfig;
			const clock = yield* Clock.Clock;
			let installationId = "installationId" in options ? options.installationId : undefined;
			const request = appRequests(client, apiUrl);
			const exchange = Effect.gen(function* () {
				const jwt = yield* appJwt(options);
				if (installationId === undefined && "owner" in options && options.owner !== undefined) {
					const path = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}/installation`;
					installationId = (yield* request("GET", path, jwt, Installation)).id;
				}
				return yield* request("POST", `/app/installations/${installationId}/access_tokens`, jwt, AccessToken, {
					permissions: options.scope?.permissions,
					repositories: options.scope?.repositories,
					"repository_ids": options.scope?.repositoryIds,
				});
			});
			const cache = yield* Cache.makeWith((_: undefined) => exchange, {
				capacity: 1,
				timeToLive: (exit) => (Exit.isSuccess(exit) ? Math.max(0, exit.value.expiresAt.getTime() - clock.currentTimeMillisUnsafe() - 300_000) : 0),
			});
			return Context.make(
				GitHubToken,
				Effect.map(Cache.get(cache, undefined), ({ token }) => Option.some(token)),
			).pipe(
				Context.add(TokenRefresh, (rejected) =>
					Cache.invalidateWhen(cache, undefined, ({ token }) => Option.isSome(rejected) && token === rejected.value),
				),
			);
		}),
	);
}

function appRequests(client: HttpClient.HttpClient, apiUrl: string) {
	const scoped = HttpClient.withScope(client);
	const rates = rateLimits();
	return Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(
		method: "GET" | "POST",
		path: string,
		jwt: Redacted.Redacted<string>,
		schema: TSchema,
		body?: unknown,
	) {
		let input = HttpClientRequest.make(method)(new URL(path, apiUrl).href, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (body !== undefined) {
			input = yield* HttpClientRequest.bodyJson(input, body).pipe(Effect.mapError((cause) => new GitHubAppError({ reason: "encode" }, { cause })));
		}
		const response = yield* authenticatedRequest(
			scoped,
			Option.some(jwt),
			rates,
		)(input).pipe(
			Effect.mapError((cause) => {
				if (cause._tag === "GitHubRateLimited") {
					return cause;
				}
				return cause._tag === "GitHubTransportError"
					? new GitHubAppError({ reason: "transport" }, { cause: cause.cause })
					: new GitHubAppError({ reason: "status", status: "status" in cause ? cause.status : 403 });
			}),
		);
		return yield* readBoundedJson(response, 64 * 1024, schema).pipe(
			Effect.mapError((cause) => new GitHubAppError({ reason: cause._tag === "HttpClientError" ? "transport" : "response" }, { cause })),
		);
	}, Effect.scoped);
}
