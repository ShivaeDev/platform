import { Effect } from "effect";
import { isolate } from "./isolation.ts";
import { acquireDatabase, StoryDatabase } from "./postgres.ts";

export const overlappingStories = Effect.fn("OrderDatabase.overlappingStories")(function* (tell: (line: string) => void) {
	const database = yield* acquireDatabase;
	const sql = database.sql;
	const first = isolate(
		Effect.gen(function* () {
			tell("the first story commits its order and waits while another story starts");
			yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'First', 1)`;
			yield* Effect.sleep("100 millis");
			return yield* database.observer`select name from orders`;
		}),
	);
	const second = isolate(
		Effect.gen(function* () {
			tell("the second story starts from empty storage after the first story finishes");
			const initial = yield* database.observer`select name from orders`;
			yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'Second', 2)`;
			return { initial, saved: yield* database.observer`select name from orders` };
		}),
	);
	const [firstRows, secondRows] = yield* Effect.all([first, second], { concurrency: "unbounded" }).pipe(
		Effect.provideService(StoryDatabase, database),
	);
	tell("both completed stories leave empty storage");
	return { firstRows, remaining: yield* database.observer`select name from orders`, secondRows };
});
