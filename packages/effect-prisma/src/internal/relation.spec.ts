import { Cause, Effect, Exit, Option, Stream } from "effect";
import { expect } from "vitest";
import { branchingUsers, branchingRows as rows } from "#test/sqlite/branchingUsers.ts";
import { failsInitialization, hasUsers, sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("adapts a Prisma-shaped thenable", [], function* ({ relationProbes }) {
	const result = yield* relationProbes.adaptThenable();
	expect(result).toEqual([{ active: true, id: 1 }]);
});

sqliteStory.it("keeps unknown Promise rejections in the defect channel", [], function* ({ relationProbes }) {
	const exit = yield* relationProbes.rejectUnknownPromise();

	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.hasDies(exit.cause)).toBe(true);
	}
});

sqliteStory.it("closes a connected client when initialization fails", [failsInitialization()], function* ({ initializationFailure }) {
	const { closeCalls, closed, connected, discoveryAttempts, exit, usersBeforeFailure } = yield* initializationFailure();

	expect(Exit.isFailure(exit)).toBe(true);
	expect(exit).toEqual(Exit.die(new Error("model discovery failed")));
	expect(closed).toBe(true);
	expect(connected).toBe(true);
	expect(discoveryAttempts).toBe(1);
	expect(closeCalls).toBe(1);
	expect(usersBeforeFailure).toBe(0);
});

sqliteStory.it("only reserves names that cannot be represented by the facade", [], ({ relationProbes }) => {
	expect(() => relationProbes.assertModelNames(["transaction"])).toThrow("Prisma model name conflicts with the database facade: transaction");
	expect(() => relationProbes.assertModelNames(["constructor", "toString"])).not.toThrow();
});

sqliteStory.it("keeps a base Relation and its branches independent", [hasUsers(branchingUsers)], function* ({ db }) {
	const base = db.User.select("id", "name");
	const active = base.where({ name: "active" });
	const firstActive = active.take(1);

	expect(yield* base).toEqual(rows);
	expect(yield* active).toEqual([rows[0], rows[2]]);
	expect(yield* firstActive).toEqual([rows[0]]);
	expect(yield* base).toEqual(rows);
});

sqliteStory.it("can execute multiple terminals against one Relation", [hasUsers(branchingUsers)], function* ({ db }) {
	const relation = db.User.select("id", "name").where({ name: "active" });

	expect(yield* relation.exists()).toBe(true);
	expect(yield* relation).toEqual([rows[0], rows[2]]);

	const first = yield* relation.first();
	expect(Option.getOrThrow(first)).toEqual(rows[0]);
});

sqliteStory.it("replays one Relation independently under concurrency", [hasUsers(branchingUsers)], function* ({ db }) {
	const relation = db.User.select("id", "name").where({ name: "active" });

	const results = yield* Effect.all([relation, relation], {
		concurrency: "unbounded",
	});

	expect(results).toEqual([
		[rows[0], rows[2]],
		[rows[0], rows[2]],
	]);
});

sqliteStory.it("exposes a cold independently consumable Stream", [hasUsers(branchingUsers)], function* ({ db }) {
	const relation = db.User.select("id", "name").where({ name: "active" });

	const first = yield* Stream.runCollect(relation.stream);
	const second = yield* Stream.runCollect(relation.stream);

	expect(first).toEqual([rows[0], rows[2]]);
	expect(second).toEqual(first);
});
