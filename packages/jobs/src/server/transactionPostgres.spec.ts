import { Effect, Option } from "effect";
import { expect } from "vitest";
import { transactionalJobs } from "#test/transactionalJobs.ts";

transactionalJobs.it("enqueue becomes visible only when its SQL transaction commits", [], function* ({ enqueue, transaction, job }) {
	const pending = Effect.gen(function* () {
		const id = Option.getOrThrow(yield* enqueue(42));
		expect(yield* job(id)).toEqual(Option.none());
		return id;
	});
	const id = yield* transaction(pending);
	expect(yield* job(id)).toMatchObject(Option.some({ data: { id: 42 }, id, state: "created" }));
});

transactionalJobs.it("enqueue rolls back with its SQL transaction", [], function* ({ enqueue, transaction, storedJobs }) {
	const failed = yield* transaction(enqueue(42).pipe(Effect.andThen(Effect.fail("rollback")))).pipe(Effect.flip);
	expect(failed).toBe("rollback");
	expect(yield* storedJobs()).toEqual([]);
});

transactionalJobs.it("enqueue outside a transaction remains durable", [], function* ({ enqueue, transaction, job }) {
	const id = Option.getOrThrow(yield* enqueue(42));
	yield* transaction(Effect.fail("unrelated rollback")).pipe(Effect.flip);
	expect(yield* job(id)).toMatchObject(Option.some({ data: { id: 42 }, id, state: "created" }));
});
