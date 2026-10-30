import { Effect } from "effect";
import { expect } from "vitest";
import { mapped } from "#test/clientNames.ts";
import { PullRequest, pull, syncOptions } from "#test/pullRequests.ts";
import { hasPullRequests } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it("a missing pull request inserts and reports a decoded row", [hasPullRequests()], function* ({ pullRequests }) {
	const { rows } = pullRequests();
	const result = yield* rows.upsert(pull(12), syncOptions);
	expect(result).toEqual({ _tag: "Inserted", inserted: true, row: pull(12) });
	if (result._tag !== "Unchanged") {
		expect(result.row).toBeInstanceOf(PullRequest);
	}
	expect(yield* rows.findById(1)).toEqual(pull(12));
});

postgres.it("a newer incoming revision replaces the stored pull request", [hasPullRequests()], function* ({ pullRequests }) {
	const { rows } = pullRequests();
	yield* rows.insert(pull(12));
	expect(yield* rows.upsert(pull(13), syncOptions)).toEqual({ _tag: "Updated", inserted: false, row: pull(13) });
	expect(yield* rows.findById(1)).toEqual(pull(13));
});

for (const hour of [11, 12]) {
	postgres.it(
		`an incoming revision at ${hour}:00 leaves the stored 12:00 revision unchanged`,
		[hasPullRequests()],
		function* ({ pullRequests, watchChanges }) {
			const { rows, tableName } = pullRequests();
			yield* rows.insert(pull(12));
			const changes = yield* watchChanges([tableName]);
			expect(yield* rows.upsert({ ...pull(hour), title: "Stale title" }, syncOptions)).toEqual({ _tag: "Unchanged" });
			expect(yield* rows.findById(1)).toEqual(pull(12));
			expect(changes).toEqual([]);
		},
	);
}

postgres.it("a writer waiting on a newer uncommitted revision cannot overwrite it", [hasPullRequests()], function* ({ pullRequests, raceWithLock }) {
	const { rows } = pullRequests();
	yield* rows.insert(pull(10));

	const results = yield* raceWithLock({
		effects: [rows.upsert(pull(11), syncOptions)],
		lock: rows.upsert(pull(13), syncOptions),
		release: "commit",
	});

	expect(yield* Effect.forEach(results, Effect.fromResult)).toEqual([{ _tag: "Unchanged" }]);
	expect(yield* rows.findById(1)).toEqual(pull(13));
});

postgres.it("a conditional batch reports each inserted, updated and unchanged input in order", [hasPullRequests()], function* ({ pullRequests }) {
	const { rows } = pullRequests();
	yield* rows.insertMany([pull(12, 1), pull(12, 2), pull(12, 3)]);
	expect(yield* rows.upsertMany([pull(13, 1), pull(11, 2), pull(12, 3), pull(14, 4)], syncOptions)).toEqual([
		{ _tag: "Updated", inserted: false, row: pull(13, 1) },
		{ _tag: "Unchanged" },
		{ _tag: "Unchanged" },
		{ _tag: "Inserted", inserted: true, row: pull(14, 4) },
	]);
	expect(yield* rows.findMany({ orderBy: { direction: "asc", field: "id" } })).toEqual([pull(13, 1), pull(12, 2), pull(12, 3), pull(14, 4)]);
});

postgres.it("a failed conditional batch rolls back its earlier writes", [hasPullRequests()], function* ({ pullRequests }) {
	const { rows } = pullRequests();
	yield* rows.insert(pull(12));
	expect((yield* rows.upsertMany([pull(13), pull(14, -1)], syncOptions).pipe(Effect.flip))._tag).toBe("SqlError");
	expect(yield* rows.findMany()).toEqual([pull(12)]);
});

postgres.it("update conditions combine encoded literals, lists, patterns and incoming equality", [hasPullRequests()], function* ({ pullRequests }) {
	const { rows } = pullRequests();
	yield* rows.insert(pull(12));
	const options = {
		updateColumns: ["updated_at"],
		updateWhere: {
			id: { in: [1, 2] },
			title: { like: "Revision%" },
			"updated_at": { gte: pull(11).updated_at, lt: { excluded: "updated_at" } },
		},
	} as const;
	expect(yield* rows.upsert(pull(13), options)).toEqual({
		_tag: "Updated",
		inserted: false,
		row: { ...pull(12), "updated_at": pull(13).updated_at },
	});
	expect(yield* rows.upsert(pull(14), { updateColumns: ["updated_at"], updateWhere: { title: { excluded: "title" } } })).toEqual({
		_tag: "Unchanged",
	});
	expect(yield* rows.upsert(pull(14), { updateColumns: ["updated_at"], updateWhere: { title: "Revision 12" } })).toMatchObject({ _tag: "Updated" });
	expect(yield* rows.upsert(pull(15), { updateColumns: ["updated_at"], updateWhere: { id: { in: [] } } })).toEqual({ _tag: "Unchanged" });
});

mapped.it("conditional upserts preserve typed outcomes with the default snake_case client", [], function* ({ rows }) {
	const original = { createdAt: new Date("2026-10-25T12:00:00Z"), id: 1 };
	const newer = { ...original, createdAt: new Date("2026-10-25T13:00:00Z") };
	const options = { updateColumns: ["createdAt"], updateWhere: { createdAt: { lt: { excluded: "createdAt" } } } } as const;
	expect(yield* rows.upsert(original, options)).toEqual({ _tag: "Inserted", inserted: true, row: original });
	expect(yield* rows.upsert(newer, options)).toEqual({ _tag: "Updated", inserted: false, row: newer });
	expect(yield* rows.upsert(original, options)).toEqual({ _tag: "Unchanged" });
	expect(yield* rows.findById(1)).toEqual(newer);
});
