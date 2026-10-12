import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { board as metadata } from "@shivaedev/work-board/integration/board.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { cycle } from "#engine/scheduler.ts";
import { admitApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("live")(
	"the first scheduler pass admits and launches 100 items in under five seconds",
	function* () {
		const files = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`${index}.md`, task(`item.${index}`, "approved")]));
		yield* withHost(files, { concurrency: 100 }, (fixture) =>
			Effect.gen(function* () {
				const parse = vi.spyOn(metadata, "metadataParse");
				yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
				const started = performance.now();
				const result = yield* withBoardReadPass(admitApproved(fixture.host).pipe(Effect.andThen(cycle)));
				expect(result.dispatched).toHaveLength(100);
				expect(result.dispatched.every((dispatch) => dispatch._tag === "Success")).toBe(true);
				expect(fixture.provider.launched).toHaveLength(100);
				expect(parse).toHaveBeenCalledTimes(100);
				expect(performance.now() - started).toBeLessThan(5000);
				yield* Effect.log(`100-item first scheduler pass: ${Math.round(performance.now() - started)} ms`);
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
		);
	},
	10_000,
);
