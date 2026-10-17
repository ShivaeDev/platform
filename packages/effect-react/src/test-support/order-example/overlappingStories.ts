import { Effect } from "effect";
import { expect } from "vitest";
import { isolate, wholeStack } from "./isolation.ts";
import { acquireDatabase, StoryDatabase } from "./postgres.ts";

export const overlappingStories = Effect.fn("OrderDatabase.overlappingStories")(function* (tell: (line: string) => void) {
	const database = yield* acquireDatabase;
	const sql = database.sql;
	const story = isolate(wholeStack);
	const first = story(
		Effect.gen(function* () {
			tell("the first story commits its order and waits while another story starts");
			yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'First', 1)`;
			yield* Effect.sleep("100 millis");
			expect(yield* database.observer`select name from orders`).toEqual([{ name: "First" }]);
		}),
	);
	const second = story(
		Effect.gen(function* () {
			tell("the second story starts from empty storage after the first story finishes");
			expect(yield* database.observer`select name from orders`).toEqual([]);
			yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'Second', 2)`;
			expect(yield* database.observer`select name from orders`).toEqual([{ name: "Second" }]);
		}),
	);
	yield* Effect.all([first, second], { concurrency: "unbounded" }).pipe(Effect.provideService(StoryDatabase, database));
	tell("both completed stories leave empty storage");
	expect(yield* database.observer`select name from orders`).toEqual([]);
});
