import type { ResourceNames } from "./names.ts";

export function resourceKit({ name, pascal, table }: ResourceNames) {
	return `import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { make${pascal}Client } from "#modules/${name}/client/make.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

type Client = Effect.Success<ReturnType<typeof make${pascal}Client>["client"]>;

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* startHost();
		return { accounts: new Map<string, Client>(), host };
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], baseUrl: engine.host.baseUrl }),
	layer: postgres,
	name: "${name}",
	stages: ["accounts", "items"],
	verbs: (engine, story) => ({
		itemsOf: (name: string) => {
			const client = engine.accounts.get(name);
			if (client === undefined) {
				throw new Error(\`Give the story signedIn("\${name}")\`);
			}
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
		visitorClient: () => make${pascal}Client(\`\${engine.host.baseUrl}/rpc\`, { webSocketConstructor: layerWebSocketConstructorWS }).client,
	}),
});

export function signedIn(name: string) {
	return app.trait("accounts", \`\${name} is signed in\`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name);
		const client = yield* make${pascal}Client(\`\${engine.host.baseUrl}/rpc\`, {
			headers: { cookie: headers.get("cookie") ?? "", origin: engine.host.origin },
			webSocketConstructor: layerWebSocketConstructorWS,
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

app.it("alice creates a trimmed title, lists it and persists it in PostgreSQL", [signedIn("alice")], function* ({ itemsOf, storedTitles }) {
	expect(yield* itemsOf("alice").list()).toEqual([]);

	const item = yield* itemsOf("alice").create("  First item  ");

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
