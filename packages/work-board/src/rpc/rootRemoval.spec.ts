import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it.live("returns specific native read errors when an external process removes the workspace root", function* () {
	workspace = yield* responseWorkspace();
	const { client } = workspace;
	yield* Effect.promise(() => client.run(client.api.navigation.run()));
	workspace.notes.remove();
	yield* Effect.promise(() => expect.poll(() => client.run(client.api.navigation.run()).then(() => "readable", String)).toContain("ReadFailed"));
	yield* Effect.promise(() =>
		expect(client.run(client.api.navigation.run())).rejects.toMatchObject({ _tag: "ReadFailed", operation: "navigation", status: 500 }),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.search.run({ query: "review" }))).rejects.toMatchObject({
			_tag: "ReadFailed",
			operation: "search",
			status: 500,
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.history.run({ action: "observe", baseline: null }))).rejects.toMatchObject({
			_tag: "ReadFailed",
			operation: "history",
			status: 500,
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.page.run({ url: "/proposal.md" }))).rejects.toMatchObject({
			_tag: "ReadFailed",
			operation: "page",
			status: 500,
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.handoffs.handoffs.run({ item: "investigation.choices" }))).rejects.toMatchObject({
			code: "Unavailable",
			message: "The workspace could not be indexed.",
		}),
	);
});
