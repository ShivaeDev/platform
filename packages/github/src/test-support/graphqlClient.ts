import { Context, Effect, Layer, Redacted, Schema, SchemaGetter } from "effect";
import { FetchHttpClient } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, graphql, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp } from "#githubApp.ts";
import { APP_ID, APP_TOKEN, PRIVATE_KEY } from "./appFixture.ts";
import { appServerAt } from "./appServer.ts";
import { answered } from "./outcome.ts";

type Base = "" | "/" | "/api/v3" | "/api/v3/";
class Prefix extends Context.Service<Prefix, string>()("@shivaedev/github/test/GraphQLPrefix") {}
const Viewer = Schema.Struct({ viewer: Schema.Struct({ name: Schema.String }).pipe(Schema.encodeKeys({ name: "login" })) });
const Prefixed = Viewer.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((data: typeof Viewer.Type) => Effect.map(Prefix, (prefix) => prefix + data.viewer.name)),
		encode: SchemaGetter.transform((name: string) => ({ viewer: { name } })),
	}),
);
const QUERY = "query Viewer { viewer { login } }";
const RequestBody = Schema.fromJsonString(Schema.Struct({ query: Schema.String, variables: Schema.Record(Schema.String, Schema.Unknown) }));

export const graphqlClient = storyKit({
	*create() {
		const root = yield* appServerAt("");
		const enterprise = yield* appServerAt("/api/v3");
		const connect = Effect.fnUntraced(function* (base: Base) {
			const { server } = base.startsWith("/api/v3") ? enterprise : root;
			return yield* Layer.build(
				GitHub.layer.pipe(
					Layer.provide(githubApp({ appId: APP_ID, installationId: 7, privateKey: Redacted.make(PRIVATE_KEY) })),
					Layer.provide(Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubConfig)({ apiUrl: `${server.url}${base}` }))),
				),
			);
		});
		return {
			contexts: { "": yield* connect(""), "/": yield* connect("/"), "/api/v3": yield* connect("/api/v3"), "/api/v3/": yield* connect("/api/v3/") },
			enterprise,
			root,
		};
	},
	name: "GitHub GraphQL client",
	stages: ["github"],
	verbs: ({ contexts, root, enterprise }, story) => {
		root.server.narrate(story.tell);
		enterprise.server.narrate(story.tell);
		return {
			askViewer: (base: Base = "", responseByteLimit?: number) => {
				story.tell(`the client at ${base || "the origin"} queries the viewer`);
				return answered(
					graphql(QUERY, { includePrivate: false }, Viewer, responseByteLimit === undefined ? undefined : { responseByteLimit }).pipe(
						Effect.provide(contexts[base]),
					),
				);
			},
			askViewerWithPrefix: (prefix: string) => {
				story.tell("the client queries the viewer with its own decoding service");
				return graphql(QUERY, {}, Prefixed).pipe(Effect.provide(contexts[""]), Effect.provideService(Prefix, prefix));
			},
			budgets: () => Effect.flatMap(GitHub, (client) => client.observations()).pipe(Effect.provide(contexts[""])),
			readPull: () => {
				story.tell("the client reads pull request 1 through REST");
				return answered(read("/repos/acme/widgets/pulls/1", Schema.Struct({ number: Schema.Number })).pipe(Effect.provide(contexts[""])));
			},
			requests: (base: Base = "") =>
				Effect.sync(() =>
					(base.startsWith("/api/v3") ? enterprise : root).server.requests
						.filter(({ path }) => path.endsWith("/graphql"))
						.map(({ path, method, body, headers, status }) => ({
							apiVersion: headers["x-github-api-version"],
							body: Schema.decodeUnknownSync(RequestBody)(body.toString()),
							credential: headers.authorization?.replace(`Bearer ${APP_TOKEN}-`, "installation token "),
							method,
							path,
							status,
						})),
				),
		};
	},
});
