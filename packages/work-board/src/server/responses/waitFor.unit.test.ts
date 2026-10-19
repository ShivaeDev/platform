import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";
import { waitReplies } from "#test/waitReplies.ts";

it.effect("preserves a nonretryable external RPC rejection without polling it again", function* () {
	const failure = new Conflict({ message: "The registered question identity is ambiguous; response history is unknown." });
	const rpc = waitReplies([Effect.fail(failure)]);
	expect(yield* Effect.flip(waitForResponse(rpc.read, () => undefined))).toMatchObject({ _tag: failure._tag, message: failure.message });
	expect(rpc.calls()).toBe(1);
});
