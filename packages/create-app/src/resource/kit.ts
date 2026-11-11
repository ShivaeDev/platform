import type { ResourceNames } from "#resource/names.ts";

export function resourceKit({ name, pascal, table }: ResourceNames) {
	return `import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { DateTime, Effect, Queue, Schema, Stream } from "effect";
import { SqlClient } from "effect/sql";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { make${pascal}Client } from "#modules/${name}/client/make.ts";
import { Item } from "#modules/${name}/${name}.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

type Client = Effect.Success<ReturnType<typeof make${pascal}Client>["client"]>;

const decodeItems = Schema.decodeUnknownSync(Schema.toType(Schema.Array(Item.json)));

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
		const accountClient = (name: string) => {
			const client = engine.accounts.get(name);
			if (client === undefined) {
				throw new Error(\`Give the story signedIn("\${name}")\`);
			}
			return client;
		};
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
			visitorClient: () => make${pascal}Client(\`\${engine.host.baseUrl}/rpc\`, { webSocketConstructor: layerWebSocketConstructor }).client,
			watchesList: (name: string) =>
				Effect.gen(function* () {
					story.tell(\`\${name} keeps the ${name} list open\`);
					const updates = yield* Queue.unbounded<QueryUpdate>();
					yield* accountClient(name)["${name}.$changes"]({ queries: [{ payload: undefined, query: "list" }] }).pipe(
						Stream.runForEach((update) => Queue.offer(updates, update)),
						Effect.forkScoped,
					);
					return {
						nextUpdate: () =>
							Effect.map(Queue.take(updates), (update) => {
								if (update._tag === "Result") {
									return decodeItems(update.value).map((item) => item.title);
								}
								return update._tag === "Unchanged" ? "unchanged" : "read denied";
							}),
					};
				}),
		};
	},
});

export function signedIn(name: string) {
	return app.trait("accounts", \`\${name} is signed in\`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name);
		const client = yield* make${pascal}Client(\`\${engine.host.baseUrl}/rpc\`, {
			headers: { cookie: headers.get("cookie") ?? "", origin: engine.host.origin },
			webSocketConstructor: layerWebSocketConstructor,
		}).client;
		engine.accounts.set(name, client);
	});
}
`;
}

export function resourceStory({ name }: ResourceNames) {
	return `import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/${name}/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it("alice creates an item, lists it and persists it in PostgreSQL", [signedIn("alice")], function* ({ itemsOf, storedTitles }) {
	expect(yield* itemsOf("alice").list()).toEqual([]);

	const item = yield* itemsOf("alice").create("First item");

	expect(item.title).toBe("First item");
	yield* outcomes([
		["alice's list", () => itemsOf("alice").list(), [{ id: item.id, title: "First item" }]],
		["stored titles", () => storedTitles(), ["First item"]],
	]);
});

app.it("bob cannot list alice's items", [signedIn("alice"), signedIn("bob")], function* ({ itemsOf }) {
	yield* itemsOf("alice").create("Alice's private item");

	const listed = yield* itemsOf("bob").list();

	expect(listed).toEqual([]);
});

app.it("alice's open list receives her new item", [signedIn("alice")], function* ({ itemsOf, watchesList }) {
	const aliceList = yield* watchesList("alice");
	expect(yield* aliceList.nextUpdate()).toEqual([]);

	yield* itemsOf("alice").create("Alice's item");

	expect(yield* aliceList.nextUpdate()).toEqual(["Alice's item"]);
});

app.it(
	"bob's new item updates his open list and sends alice's none, so her next update carries her own item",
	[signedIn("alice"), signedIn("bob")],
	function* ({ itemsOf, watchesList }) {
		const aliceList = yield* watchesList("alice");
		const bobList = yield* watchesList("bob");
		expect(yield* aliceList.nextUpdate()).toEqual([]);
		expect(yield* bobList.nextUpdate()).toEqual([]);

		yield* itemsOf("bob").create("Bob's item");

		expect(yield* bobList.nextUpdate()).toEqual(["Bob's item"]);
		yield* itemsOf("alice").create("Alice's item");
		expect(yield* aliceList.nextUpdate()).toEqual(["Alice's item"]);
	},
);

app.it("a visitor cannot create items", [], function* ({ visitorClient }) {
	const client = yield* visitorClient();

	const replied = yield* answer(client["${name}.create"]({ title: "Anonymous item" }));

	expect(replied).toBe("sign in required");
});

app.it("a visitor cannot list items", [], function* ({ visitorClient }) {
	const client = yield* visitorClient();

	const replied = yield* answer(client["${name}.list"]());

	expect(replied).toBe("sign in required");
});
`;
}
