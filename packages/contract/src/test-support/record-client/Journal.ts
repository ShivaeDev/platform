import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { delegatedSubject } from "@shivaedev/identity/subject.ts";
import { contract } from "#contract.ts";
import { command, query, stream } from "#operation.ts";

export class NotYourClient extends Schema.TaggedError<NotYourClient>()("NotYourClient", { account: Schema.String }) {}

export const coaching = delegatedSubject({
	deny: (account) => new NotYourClient({ account }),
	refusal: NotYourClient,
	service: "@shivaedev/contract/test/record-client/Coaching",
});

// An entry cannot name its account in its reads, so every account's journal reruns on any entry and must keep its own subject.
export const journals = collection("record-journals", Schema.String);

export const Journal = contract("journal", {
	commands: [command("write", { invalidates: () => [journals.list], payload: { entry: Schema.String }, success: Schema.Void })],
	queries: [query("entries", { readPolicy: () => Effect.succeed(true), reads: () => [journals.list], success: Schema.String })],
	streams: [stream("owner", { reads: () => [], success: Schema.String })],
	subject: coaching,
});
