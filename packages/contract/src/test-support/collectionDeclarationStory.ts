import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";

export const collectionDeclarationStory = storyKit({
	create: () => Effect.succeed(collection("workspaces", Schema.Int)),
	name: "collection read declarations",
	stages: [],
	verbs: (workspaces, story) => ({
		buildMemberContract: () => {
			story.tell("build an untyped member contract declaring collection-wide reads");
			return Effect.try(() => {
				const member = query("all", { readPolicy: signedIn, reads: () => [] });
				Reflect.set(member, "readsCollections", [workspaces]);
				contract("workspaces", { queries: [member] });
				return "built";
			}).pipe(Effect.catchTag("UnknownError", ({ cause }) => Effect.succeed(cause instanceof Error ? cause.message : String(cause))));
		},
	}),
});
