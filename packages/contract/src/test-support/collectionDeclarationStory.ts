import { Cause, Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";
import { validateReadPolicies } from "#validateReadPolicies.ts";

export const collectionDeclarationStory = storyKit({
	create: () => Effect.succeed(collection("workspaces", Schema.Int)),
	name: "collection read declarations",
	stages: [],
	verbs: (workspaces, story) => ({
		buildMemberContract: () =>
			Effect.gen(function* () {
				story.tell("build an untyped member contract declaring collection-wide reads");
				const member = query("all", { readPolicy: signedIn, reads: () => [] });
				Reflect.set(member, "readsCollections", [workspaces]);
				const exit = yield* Effect.exit(validateReadPolicies(contract("workspaces", { queries: [member] })));
				if (exit._tag === "Failure") {
					const failure = Cause.squash(exit.cause);
					return failure instanceof Error ? failure.message : String(failure);
				}
				return "built";
			}),
	}),
});
