import { Effect, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { expect, it } from "vitest";
import { contract } from "#contract.ts";
import { command, query, stream } from "#operation.ts";
import { operationKind } from "#operationKind.ts";

const Notes = contract("notes", {
	commands: [command("save", { invalidates: () => [] })],
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
	streams: [stream("follow", { reads: () => [], success: Schema.String })],
});

it("a query, the changes stream and a stream read, while a command and an unmarked RPC write", () => {
	const kinds = Object.fromEntries([...Notes.requests.values()].map((rpc) => [rpc._tag, operationKind(rpc)]));

	expect({ ...kinds, unmarked: operationKind(Rpc.make("unmarked")) }).toEqual({
		"notes.$changes": "read",
		"notes.follow": "read",
		"notes.read": "read",
		"notes.save": "write",
		unmarked: "write",
	});
});
