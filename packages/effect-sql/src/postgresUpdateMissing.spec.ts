import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { Measurement, Prefix } from "#test/compositeMeasurements.ts";
import { Reading } from "#test/postgresBatch.ts";
import { hasCompositeMeasurements } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasBatchReadings } from "#test/sqlTraits.ts";

postgres.it(
	"opt-in updates decode and announce a single-key row only after commit",
	[hasBatchReadings()],
	function* ({ batchFixture, captureStatement, recordSpans, transact, watchChanges }) {
		const { plain, tableName } = batchFixture();
		const original = yield* plain.insert({ amount: 10, label: "Draft", source: "meter" });
		const keys = [tableName, `${tableName}:${original.id}`];
		const changes = yield* watchChanges(keys);
		const { observe, spans } = recordSpans();
		const write = yield* captureStatement(
			Effect.gen(function* () {
				const updated = yield* observe(plain.update({ ...original, amount: 20 }, { onMissing: "fail" }));
				expect(changes).toEqual([]);
				return updated;
			}).pipe(transact({ onSqlError: (error) => error })),
		);
		expect(write.rows).toBeInstanceOf(Reading);
		expect(write.rows).toEqual({ ...original, amount: 20 });
		expect(write.statements.filter(([query]) => /^(?:update|select)/u.test(query))).toEqual([
			[expect.stringMatching(/^update .* where .*"id" = .* returning \*$/u), expect.any(Array)],
		]);
		expect(changes).toEqual(keys);
		expect(spans.filter((span) => span.name === "BatchReading.update").map((span) => span.status._tag)).toEqual(["Ended"]);
	},
);

postgres.it(
	"an absent single-key row fails in the error channel and announces nothing",
	[hasBatchReadings()],
	function* ({ batchFixture, captureStatement, watchChanges }) {
		const { plain, tableName } = batchFixture();
		const changes = yield* watchChanges([tableName, `${tableName}:1`]);
		const write = yield* captureStatement(
			plain.update({ amount: 20, id: 1, label: "Missing", source: "meter" }, { onMissing: "fail" }).pipe(Effect.flip),
		);
		expect(write.rows).toBeInstanceOf(Cause.NoSuchElementError);
		expect(write.statements.filter(([query]) => /^(?:update|select)/u.test(query))).toEqual([
			[expect.stringMatching(/^update .* returning \*$/u), expect.any(Array)],
		]);
		expect(changes).toEqual([]);
	},
);

postgres.it("ordinary updates retain their missing-row defect", [hasBatchReadings()], function* ({ batchFixture, watchChanges }) {
	const { plain, tableName } = batchFixture();
	const changes = yield* watchChanges([tableName, `${tableName}:1`]);
	const exit = yield* plain.update({ amount: 20, id: 1, label: "Missing", source: "meter" }).pipe(Effect.exit);
	expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
	expect(changes).toEqual([]);
});

postgres.it(
	"opt-in composite updates encode keys, decode results and announce only after commit",
	[hasCompositeMeasurements()],
	function* ({ compositeMeasurements, captureStatement, transact, watchChanges }) {
		const { readings, tableName } = compositeMeasurements();
		yield* Effect.gen(function* () {
			const original = yield* readings.insert({ amount: 10, sequence: 1, source: "meter" });
			const keys = [tableName, `${tableName}:["encoded/meter",1]`];
			const changes = yield* watchChanges(keys);
			const write = yield* captureStatement(
				Effect.gen(function* () {
					const updated = yield* readings.update({ ...original, amount: 20 }, { onMissing: "fail" });
					expect(changes).toEqual([]);
					return updated;
				}).pipe(transact({ onSqlError: (error) => error })),
			);
			expect(write.rows).toBeInstanceOf(Measurement);
			expect(write.rows).toEqual({ ...original, amount: 20 });
			expect(write.statements.filter(([query]) => /^(?:update|select)/u.test(query))).toEqual([
				[expect.stringMatching(/^update .* where .*"source" = .*"sequence" = .* returning \*$/u), ["20", "encoded/meter", 1]],
			]);
			expect(changes).toEqual(keys);
		}).pipe(Effect.provideService(Prefix, "encoded/"));
	},
);

postgres.it(
	"an absent composite key fails without changing or announcing a row sharing part of its key",
	[hasCompositeMeasurements()],
	function* ({ compositeMeasurements, captureStatement, watchChanges }) {
		const { readings, tableName } = compositeMeasurements();
		yield* Effect.gen(function* () {
			const original = yield* readings.insert({ amount: 10, sequence: 1, source: "meter" });
			const changes = yield* watchChanges([tableName, `${tableName}:["encoded/meter",1]`, `${tableName}:["encoded/meter",2]`]);
			const write = yield* captureStatement(readings.update({ ...original, sequence: 2 }, { onMissing: "fail" }).pipe(Effect.flip));
			expect(write.rows).toBeInstanceOf(Cause.NoSuchElementError);
			expect(write.statements.filter(([query]) => /^(?:update|select)/u.test(query))).toEqual([
				[expect.stringMatching(/^update .* returning \*$/u), ["10", "encoded/meter", 2]],
			]);
			expect(yield* readings.findById(original)).toEqual(original);
			expect(changes).toEqual([]);
		}).pipe(Effect.provideService(Prefix, "encoded/"));
	},
);

postgres.it("rolled-back opt-in updates discard changes", [hasBatchReadings()], function* ({ batchFixture, transact, watchChanges }) {
	const { plain, tableName } = batchFixture();
	const original = yield* plain.insert({ amount: 10, label: "Draft", source: "meter" });
	const changes = yield* watchChanges([tableName, `${tableName}:${original.id}`]);
	yield* Effect.gen(function* () {
		yield* plain.update({ ...original, amount: 20 }, { onMissing: "fail" });
		return yield* Effect.fail("cancelled");
	}).pipe(transact({ onSqlError: (error) => error }), Effect.flip);
	expect(yield* plain.findById(original.id)).toEqual(original);
	expect(changes).toEqual([]);
});
