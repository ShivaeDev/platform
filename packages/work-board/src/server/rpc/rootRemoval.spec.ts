import { Effect } from "effect";
import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";

boardStory.it(
	"returns specific native errors after an outside process removes the workspace",
	[aQuestionnaire()],
	function* ({ client, removeProject }) {
		yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "" })));
		removeProject();
		yield* Effect.promise(() =>
			expect.poll(() => client.run(client.api.navigation.run({ current: "" })).then(() => "readable", String)).toContain("InternalServerError"),
		);
		for (const read of [
			client.api.navigation.run({ current: "" }).pipe(Effect.asVoid),
			client.api.search.run({ query: "review" }).pipe(Effect.asVoid),
			client.api.document.run({ url: "/proposal.md" }).pipe(Effect.asVoid),
		]) {
			yield* Effect.promise(() => expect(client.run(read)).rejects.toMatchObject({ _tag: "InternalServerError" }));
		}
		yield* Effect.promise(() =>
			expect(client.run(client.handoffs.handoffs.run({ item: "investigation.choices" }))).rejects.toMatchObject({
				_tag: "ServiceUnavailable",
				message: "The workspace could not be indexed.",
			}),
		);
	},
);
