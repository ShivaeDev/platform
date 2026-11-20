import { Cause, Context, Effect, ErrorReporter, Layer, Logger, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Model } from "effect/schema";
import { appHost } from "@shivaedev/server/appHost.ts";
import { serverOnly } from "@shivaedev/sql/serverOnly.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { answered } from "#test/answers.ts";

const SECRET = "digest-of-alice";

export class Credential extends Model.Class<Credential>("Credential")({
	digest: serverOnly(Schema.String),
	id: Schema.Number,
	owner: Schema.String,
}) {}

class SensitiveRedactedCredential extends Model.Class<SensitiveRedactedCredential>("SensitiveRedactedCredential")({
	digest: Model.Sensitive(Schema.RedactedFromValue(Schema.String)),
	id: Schema.Number,
	owner: Schema.String,
}) {}

class SensitiveCredential extends Model.Class<SensitiveCredential>("SensitiveCredential")({
	digest: Model.Sensitive(Schema.String),
	id: Schema.Number,
	owner: Schema.String,
}) {}

const PublicCredential = Schema.Struct({ id: Schema.Number, owner: Schema.String });

const Api = contract("credentials", {
	queries: [
		query("storedRow", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Credential }),
		query("castRow", { readPolicy: () => Effect.succeed(true), reads: () => [], success: PublicCredential }),
		query("sensitiveRedactedRow", { readPolicy: () => Effect.succeed(true), reads: () => [], success: SensitiveRedactedCredential }),
		query("sensitiveRow", { readPolicy: () => Effect.succeed(true), reads: () => [], success: SensitiveCredential }),
	],
});

const stored = Effect.sync(() => new Credential({ digest: Redacted.make(SECRET), id: 1, owner: "alice" }));

const handlers = Api.application.toLayer({
	"credentials.castRow": () => Effect.map(stored, (row): typeof PublicCredential.Type => row),
	"credentials.sensitiveRedactedRow": () =>
		Effect.sync(() => new SensitiveRedactedCredential({ digest: Redacted.make(SECRET), id: 1, owner: "alice" })),
	"credentials.sensitiveRow": () => Effect.sync(() => new SensitiveCredential({ digest: SECRET, id: 1, owner: "alice" })),
	"credentials.storedRow": () => stored,
});

const CALLED = {
	castRow: "whose handler returns the stored credential typed as the public struct",
	sensitiveRedactedRow: "whose hand-written contract sends a credential class with a Model.Sensitive Redacted digest",
	sensitiveRow: "whose hand-written contract sends a credential class with a Model.Sensitive string digest",
	storedRow: "whose hand-written contract sends the stored credential class with its serverOnly digest",
} as const;

export type Operation = keyof typeof CALLED;

// JSON.stringify hands a replacer what toJSON returned, so the replacer reads the raw value from its holder.
function opened(this: Readonly<Record<string, unknown>>, key: string, value: unknown) {
	const raw = this[key];
	return Redacted.isRedacted(raw) ? `Redacted(${String(Redacted.value(raw))})` : value;
}

interface Recorded {
	readonly bodies: string[];
	readonly logs: string[];
	readonly reports: string[];
}

// Keeps each response body the server sent, then hands the RPC client a response with the same bytes.
function recordingBodies(recorded: Recorded) {
	return Layer.effect(
		HttpClient.HttpClient,
		Effect.map(HttpClient.HttpClient, (client) =>
			HttpClient.transformResponse(client, (response) =>
				Effect.flatMap(response, (sent) =>
					Effect.map(sent.text, (body) => {
						recorded.bodies.push(body);
						return HttpClientResponse.fromWeb(sent.request, new Response(body, { headers: sent.headers, status: sent.status }));
					}),
				),
			),
		),
	).pipe(Layer.provide(FetchHttpClient.layer));
}

function recordingDiagnostics(recorded: Recorded) {
	return Layer.mergeAll(
		Logger.layer([
			Logger.make(({ cause, message }) => {
				recorded.logs.push(`${JSON.stringify(message)}${cause.reasons.length === 0 ? "" : `\n${Cause.pretty(cause)}`}`);
			}),
		]),
		ErrorReporter.layer([
			ErrorReporter.make(({ error }) => {
				recorded.reports.push(error.message);
			}),
		]),
	);
}

export const serverOnlyRows = storyKit({
	clock: "test",
	*create() {
		const recorded: Recorded = { bodies: [], logs: [], reports: [] };
		const services = yield* Layer.build(appHost({ config: { port: 0 }, group: Api, handlers, policy: "loopback" })).pipe(
			Effect.provide(recordingDiagnostics(recorded)),
		);
		const server = Context.get(services, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Expected a TCP listener");
		}
		const protocol = RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${server.address.port}/rpc` }).pipe(
			Layer.provide([recordingBodies(recorded), RpcSerialization.layerNdjson]),
		);
		const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provide(protocol));
		return { client, recorded };
	},
	name: "server-only rows over RPC",
	stages: [],
	verbs: ({ client, recorded }, story) => ({
		call: (operation: Operation) => {
			story.tell(`the HTTP client calls ${operation}, ${CALLED[operation]}`);
			return answered(client(`credentials.${operation}`, undefined), (value) => JSON.stringify(value, opened));
		},
		sentBodiesHoldTheDigest: () => Effect.sync(() => recorded.bodies.some((body) => body.includes(SECRET))),
		serverDiagnostics: () => Effect.sync(() => [...recorded.logs, ...recorded.reports]),
	}),
});
