import { sign } from "node:crypto";
import { Clock, Effect, Exit, Layer, Option, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedJson } from "@shivaedev/platform/http-client/body.ts";
import { GitHubAppError } from "./errors.ts";
import { GitHubConfig } from "./GitHubConfig.ts";
import { GitHubToken } from "./GitHubToken.ts";

export type GitHubAppOptions = {
	readonly appId: string;
	readonly privateKey: Redacted.Redacted<string>;
} & ({ readonly installationId: number } | { readonly owner: string; readonly repository: string });

const Installation = Schema.Struct({ id: Schema.Number });
const AccessToken = Schema.Struct({ expiresAt: Schema.DateFromString, token: Schema.RedactedFromValue(Schema.String) }).pipe(
	Schema.encodeKeys({ expiresAt: "expires_at" }),
);

export function githubApp(options: GitHubAppOptions) {
	return Layer.effect(GitHubToken)(
		Effect.gen(function* () {
			const client = yield* HttpClient.HttpClient;
			const { apiUrl } = yield* GitHubConfig;
			const clock = yield* Clock.Clock;
			let installationId = "installationId" in options ? options.installationId : undefined;
			const request = appRequests(client, apiUrl);
			const exchange = Effect.gen(function* () {
				const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
				const jwt = yield* Effect.try({
					catch: () => new GitHubAppError({ stage: "sign" }),
					try: () => {
						const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
						const payload = Buffer.from(JSON.stringify({ exp: now + 600, iat: now - 60, iss: options.appId })).toString("base64url");
						const input = `${header}.${payload}`;
						return `${input}.${sign("RSA-SHA256", Buffer.from(input), Redacted.value(options.privateKey)).toString("base64url")}`;
					},
				});
				if (installationId === undefined && "owner" in options) {
					const path = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}/installation`;
					installationId = (yield* request("GET", path, jwt, Installation)).id;
				}
				return yield* request("POST", `/app/installations/${installationId}/access_tokens`, jwt, AccessToken);
			});
			const cached = yield* Effect.cachedWithTTL(exchange, (exit) =>
				Exit.isSuccess(exit) ? Math.max(0, exit.value.expiresAt.getTime() - clock.currentTimeMillisUnsafe() - 300_000) : 0,
			);
			return Effect.map(cached, ({ token }) => Option.some(token));
		}),
	);
}

function appRequests(client: HttpClient.HttpClient, apiUrl: string) {
	return Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(method: "GET" | "POST", path: string, jwt: string, schema: TSchema) {
		const response = yield* client
			.execute(
				HttpClientRequest.make(method)(new URL(path, apiUrl).href, {
					headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${jwt}`, "X-GitHub-Api-Version": "2022-11-28" },
				}),
			)
			.pipe(Effect.mapError(() => new GitHubAppError({ stage: "exchange" })));
		if (response.status < 200 || response.status >= 300) {
			return yield* new GitHubAppError({ stage: "exchange", status: response.status });
		}
		return yield* readBoundedJson(response, 64 * 1024, schema).pipe(Effect.mapError(() => new GitHubAppError({ stage: "exchange" })));
	});
}
