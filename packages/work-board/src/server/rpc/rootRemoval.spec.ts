import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it.live("returns specific native read errors when an external process removes the workspace root", function* () {
	workspace = yield* responseWorkspace();
	const { client } = workspace;
	yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "" })));
	workspace.notes.remove();
	yield* Effect.promise(() =>
		expect.poll(() => client.run(client.api.navigation.run({ current: "" })).then(() => "readable", String)).toContain("InternalServerError"),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.navigation.run({ current: "" }))).rejects.toMatchObject({
			_tag: "InternalServerError",
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.search.run({ query: "review" }))).rejects.toMatchObject({
			_tag: "InternalServerError",
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.api.document.run({ url: "/proposal.md" }))).rejects.toMatchObject({
			_tag: "InternalServerError",
		}),
	);
	yield* Effect.promise(() =>
		expect(client.run(client.handoffs.handoffs.run({ item: "investigation.choices" }))).rejects.toMatchObject({
			_tag: "ServiceUnavailable",
			message: "The workspace could not be indexed.",
		}),
	);
});
