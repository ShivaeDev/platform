import { Effect } from "effect";
import { expect } from "vitest";
import { Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import { it } from "@shivaedev/test/it.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";
import { waitReplies } from "#test/waitReplies.ts";

it.effect("preserves a nonretryable external RPC rejection without polling it again", function* () {
	const failure = new Conflict({ message: "The registered question identity is ambiguous; response history is unknown." });
	const rpc = waitReplies([Effect.fail(failure)]);
	expect(yield* Effect.flip(waitForResponse(rpc.read, () => undefined))).toMatchObject({ _tag: failure._tag, message: failure.message });
	expect(rpc.calls()).toBe(1);
});
