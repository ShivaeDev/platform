import { describe, expect } from "@effect/vitest";
import { Effect, Tracer } from "effect";
import { readWaitStates } from "#host/readWaitStates.ts";
import type { FleetCycleSnapshot } from "#model.ts";
import { withHost } from "#test/fleetHost.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";
import { storeState } from "#test/storeState.ts";

describe("Fleet summary reads against PostgreSQL", () => {
	const test = postgresTests("live");

	test("100 items read in one query per poll without execution history", function* () {
		const history = [
			{
				archivedAt: 1,
				attempts: [],
				boardRevision: "old",
				cwd: "/synthetic",
				preparation: prepared(),
				prompt: "x".repeat(100_000),
				stage: "completed",
			},
		] satisfies readonly FleetCycleSnapshot[];
		yield* withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				const ids = Array.from({ length: 100 }, (_, index) => `item-${index}`);
				for (const id of ids) {
					yield* storeState(fixture.host, id, { history, stage: "executing" });
				}
				for (let poll = 0; poll < 2; poll += 1) {
					const spans: Tracer.NativeSpan[] = [];
					const tracer = Tracer.make({
						span: (options) => {
							const span = new Tracer.NativeSpan(options);
							spans.push(span);
							return span;
						},
					});
					const states = yield* readWaitStates(fixture.host, ids).pipe(Effect.withTracer(tracer));
					expect(states).toHaveLength(100);
					expect(states[0]).toEqual({ outcome: {}, stage: "executing", workId: "item-0" });
					const statements = spans.flatMap((span) => {
						const text = span.attributes.get("db.query.text");
						return typeof text === "string" ? [text] : [];
					});
					expect(statements).toHaveLength(1);
					expect(statements[0]).not.toContain('"history"');
				}
			}).pipe(Effect.provide(hostDatabase(fixture.host, "work-fleet-reader", 1))),
		);
	});
	test("waiting summaries retain a stable code beside reworded reason text", () =>
		withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				const decision = { attentionOwner: "maintainer", code: "reviewed-pr-ready", reason: "A human can merge this reviewed change now." };
				yield* storeState(fixture.host, "one", { decision, stage: "needs-human" });
				expect(yield* readWaitStates(fixture.host, ["one"])).toEqual([{ decision, outcome: {}, stage: "needs-human", workId: "one" }]);
			}).pipe(Effect.provide(hostDatabase(fixture.host, "work-fleet-reader", 1))),
		));
});
