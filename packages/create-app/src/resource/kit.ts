import type { ResourceNames } from "#resource/names.ts";

export function resourceKit({ camel, name, pascal, table }: ResourceNames) {
	return `import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { DateTime, Effect, Queue, Schema, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { mintUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ${pascal} } from "#generated/modules/${name}/${pascal}.ts";
import { Item } from "#modules/${name}/model.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";

type Client = Effect.Success<ReturnType<typeof makeClient<{ ${camel}: typeof ${pascal} }>>["client"]>;

const decodeItems = Schema.decodeUnknownSync(Schema.toType(Schema.Array(Item.json)));

function describeUpdate(update: QueryUpdate) {
	if (update._tag === "Result") {
		return decodeItems(update.value).map((item) => item.title);
	}
	return update._tag === "Unchanged" ? "unchanged" : "read denied";
}

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const host = yield* startHost();
		return { accounts: new Map<string, Client>(), host };
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], baseUrl: engine.host.baseUrl }),
	layer: postgres,
	name: "${name}",
	stages: ["accounts", "items"],
	verbs: (engine, story) => {
		function accountClient(name: string) {
			const client = engine.accounts.get(name);
			if (client === undefined) {
				throw new Error(\`Give the story signedIn("\${name}")\`);
			}
			return client;
		}
		return {
			itemsOf: (name: string) => {
				const client = accountClient(name);
				return {
					create: (title: string) => {
						story.tell(\`\${name} creates \${JSON.stringify(title)}\`);
						return client["${name}.create"]({ title });
					},
					list: () => {
						story.tell(\`\${name} lists ${name}\`);
						return client["${name}.list"]();
					},
				};
			},
			storedTitles: () =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const rows = yield* sql<{ title: string }>\`select title from \${sql("${table}")} order by id desc\`;
					return rows.map((row) => row.title);
				}),
			visitorClient: () => makeClient({ ${camel}: ${pascal} }, { url: \`\${engine.host.baseUrl}/rpc\`, webSocketConstructor: layerWebSocketConstructor }).client,
			watchesList: (name: string) =>
				Effect.gen(function* () {
					story.tell(\`\${name} keeps the ${name} list open\`);
					const updates = yield* Queue.unbounded<QueryUpdate>();
					const client = accountClient(name);
					yield* client["${name}.$changes"]({ queries: [{ payload: undefined, query: "list" }] }).pipe(
						Stream.runForEach((update) => Queue.offer(updates, update)),
						Effect.forkScoped,
					);
					return { nextUpdate: () => Effect.map(Queue.take(updates), describeUpdate) };
				}),
		};
	},
});

export function signedIn(name: string) {
	return app.trait("accounts", \`\${name} is signed in\`, function* (engine) {
		const { headers } = yield* mintUser(AppAuth, engine.host, name);
		const client = yield* makeClient({ ${camel}: ${pascal} }, {
			headers: { cookie: headers.get("cookie") ?? "", origin: engine.host.origin },
			url: \`\${engine.host.baseUrl}/rpc\`,
			webSocketConstructor: layerWebSocketConstructor,
		}).client;
		engine.accounts.set(name, client);
	});
}
`;
}
