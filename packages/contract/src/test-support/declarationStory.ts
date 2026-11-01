import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { command, query, stream } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";

function operationsFor(kind: "query" | "command" | "stream", name: string) {
	if (kind === "query") {
		return { queries: [query(name, { readPolicy: signedIn, reads: () => [] })] };
	}
	if (kind === "command") {
		return { commands: [command(name, { invalidates: () => [] })] };
	}
	return { streams: [stream(name, { reads: () => [], success: Schema.String })] };
}

export const declarationStory = storyKit({
	create: () => Effect.void,
	name: "contract declarations",
	stages: [],
	verbs: (_engine, story) => ({
		declare: (kind: "query" | "command" | "stream", name: string) => {
			story.tell(`declare a contract with a ${kind} named ${name}`);
			return Effect.try(() => {
				const declared = contract("notes", operationsFor(kind, name));
				return { application: [...declared.application.requests.keys()], rpcs: [...declared.requests.keys()] };
			}).pipe(Effect.catchTag("UnknownError", ({ cause }) => Effect.succeed(cause instanceof Error ? cause.message : String(cause))));
		},
	}),
});
