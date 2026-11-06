import { inStory, kitFiles } from "#testing/adapters/storySpecFiles.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

export const generatorEntries: SeedFile = {
	content: [
		'import { it as test } from "vitest";',
		'import { makeEffectIt } from "./test-support/entry.ts";',
		"const it = makeEffectIt();",
		'it("reads a durable session", function* ({ sessions }) { yield* sessions.read(); });',
		'test("calls done", (done) => { done(); });',
		'test("generator calls done", function* (done) { done(); yield 1; });',
	].join("\n"),
	path: "src/postgres.test.ts",
};

export const durableSessions: readonly SeedFile[] = [
	{ content: "sql`CREATE TABLE session (id text PRIMARY KEY, agent_id text NOT NULL, history jsonb NOT NULL);`;", path: "src/storage/migration.ts" },
	{ content: "sql`SELECT history FROM session`;", path: "src/storage/read.ts" },
	{ content: "CREATE TABLE auth.session (id text, token text, user_id text, expires_at timestamp);", path: "src/identity/migration.sql" },
	{ content: "sql`SELECT token FROM auth.session`;", path: "src/leak.ts" },
	{
		content: 'sql.unsafe("SELECT * FROM " + table + " WHERE id = 1"); sql`SELECT * FROM information_schema.columns`;',
		path: "src/identity/queries.ts",
	},
	{ content: "sql`SELECT column_name FROM information_schema.columns`;", path: "src/storage/catalog.ts" },
];

export const durableEvents: SeedFile = {
	content: `import { Schema } from "effect";
const AgentEvent = Schema.TaggedStruct("AgentStarted", { agentId: Schema.String });
${inStory("const history = yield* events();", 'expect(history[0]._tag).toBe(AgentEvent.make({ agentId: "one" })._tag);', "const { _tag: kind } = history[0];", 'expect(kind).toBe("AgentStarted");')}`,
	path: "src/postgres.test.ts",
};

export function eventWaits(body: string, helper = "eventually"): readonly SeedFile[] {
	return [
		...kitFiles,
		{
			content: 'import { app } from "#test/index.ts"; app.it("reconciles", [], function* ({ reconcile }) { yield* reconcile(); });',
			path: "src/orders.spec.ts",
		},
		{
			content: `import { storyKit } from "@shivaedev/test-story/server/storyKit.ts"; import { ${helper} } from "#test/reconciliation.ts"; export const orders = storyKit({ verbs: () => ({ reconcile: () => ${helper}() }) });`,
			path: "src/test-support/orders.ts",
		},
		{
			content: `import { Effect, Queue, Stream } from "effect"; export const ${helper} = Effect.fn(function* () { ${body} });`,
			path: "src/test-support/reconciliation.ts",
		},
	];
}

export const fileInputs: SeedFile = {
	content:
		'export const Upload = () => <input type="file" accept="image/jpeg, image/png, image/webp" />;\nexport const InvalidUpload = () => <input type="file" accept="banana" />;',
	path: "src/Upload.tsx",
};

export const rendererCss: SeedFile = {
	content: "::picker-icon { color: red; }\n::checkmark { color: red; }\n",
	path: "src/renderer.css",
};

export function registryFacts(glob: string, reason: string): readonly SeedFile[] {
	return [
		{ content: JSON.stringify({ name: "registry-app", quality: { toolOwned: [{ glob, reason }] } }), path: "package.json" },
		{ content: "debugger;", path: "src/components/ui/button.tsx" },
	];
}
