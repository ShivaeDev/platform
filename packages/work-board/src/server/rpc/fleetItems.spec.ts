import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { workRpcs } from "#rpc/contract.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { inMemoryBoard } from "#test/inMemoryBoard.ts";

it.live("returns InternalServerError when the Fleet items index read dies", function* () {
	const missing = { cause: "Not configured", observedAt: 0, state: "not-configured" as const };
	const daemon = yield* diagnosticsDaemon(() => ({ codex: missing, fleet: missing, github: missing }));
	const result = yield* Effect.gen(function* () {
		const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
		return yield* client("work-board.fleetItems", undefined).pipe(Effect.result);
	}).pipe(
		Effect.provide(
			inMemoryBoard(
				{ "note.md": "# Note" },
				{
					fleetPort: daemon.port,
					home: undefined,
					index: Effect.die(new Error("Unexpected index defect")),
				},
			),
		),
	);
	expect(result).toMatchObject({ _tag: "Failure", failure: expect.any(InternalServerError) });
});
