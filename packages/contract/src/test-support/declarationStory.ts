import { Cause, Effect, Schema } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { type CommandShape, command, query, type StreamShape, stream } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";
import { operationsFor } from "#test/operationsFor.ts";
import { validateReadPolicies } from "#validateReadPolicies.ts";

type InvalidDeclaration =
	| "duplicate queries"
	| "duplicate query and command"
	| "duplicate streams"
	| "reserved query"
	| "reserved command"
	| "reserved stream";

function failureMessage<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return Effect.exit(validateReadPolicies(group)).pipe(
		Effect.map((exit) => {
			if (exit._tag === "Failure") {
				const failure = Cause.squash(exit.cause);
				return failure instanceof Error ? failure.message : String(failure);
			}
			return "validated";
		}),
	);
}

export const declarationStory = storyKit({
	create: () => Effect.succeed(undefined),
	name: "contract declaration validation",
	stages: [],
	verbs: (_state, story) => ({
		validate: (kind: InvalidDeclaration) => {
			story.tell(`the server validates a contract with ${kind}`);
			switch (kind) {
				case "duplicate queries": {
					const same = query("same", { readPolicy: signedIn, reads: () => [] });
					const queries: readonly (typeof same)[] = [same, same];
					return failureMessage(contract("dupes", { queries }));
				}
				case "duplicate query and command": {
					const same = query("same", { readPolicy: signedIn, reads: () => [] });
					const queries: readonly (typeof same)[] = [same];
					const commands: readonly CommandShape[] = [command("same", { invalidates: () => [] })];
					return failureMessage(contract("dupes", { commands, queries }));
				}
				case "duplicate streams": {
					const same = stream("same", { reads: () => [], success: Schema.String });
					const streams: readonly StreamShape[] = [same, same];
					return failureMessage(contract("dupes", { streams }));
				}
				case "reserved query":
					return failureMessage(contract("notes", operationsFor("query", "$changes")));
				case "reserved command":
					return failureMessage(contract("notes", operationsFor("command", "$changes")));
				case "reserved stream":
					return failureMessage(contract("notes", operationsFor("stream", "$changes")));
			}
		},
	}),
});
