import { Deferred, Effect, Exit } from "effect";
import { SqlClient } from "effect/sql";
import { createApplication } from "./applicationEngine.ts";
import { isolate } from "./isolation.ts";
import { acquireDatabase, StoryDatabase } from "./postgres.ts";
import { activeScreens, openScreen } from "./screens.ts";
import { settleOrders } from "./screenVerbs.ts";
import { seedOrder } from "./seed.ts";

export const overlappingStories = Effect.fn("OrderDatabase.overlappingStories")(function* (tell: (line: string) => void) {
	const database = yield* acquireDatabase;
	const sql = database.sql;
	const secondRequested = yield* Deferred.make<void>();
	const first = isolate(
		Effect.gen(function* () {
			tell("the first story commits its order and waits until a second story asks to start");
			yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'First', 1)`;
			yield* Deferred.await(secondRequested);
			return yield* database.observer<{ readonly name: string }>`select name from orders`;
		}),
	);
	const second = Effect.gen(function* () {
		yield* Deferred.succeed(secondRequested, undefined);
		return yield* isolate(
			Effect.gen(function* () {
				tell("the second story runs");
				const initial = yield* database.observer<{ readonly name: string }>`select name from orders`;
				yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'Second', 2)`;
				return { initial, saved: yield* database.observer<{ readonly name: string }>`select name from orders` };
			}),
		);
	});
	const [firstRows, secondRows] = yield* Effect.all([first, second], { concurrency: "unbounded" }).pipe(
		Effect.provideService(StoryDatabase, database),
	);
	function names(rows: readonly { readonly name: string }[]) {
		return rows.map((row) => row.name);
	}
	return {
		afterwards: names(yield* database.observer<{ readonly name: string }>`select name from orders`),
		"first story saw": names(firstRows),
		"second story saw": names(secondRows.saved),
		"second story started with": names(secondRows.initial),
	};
});

export const failingApplicationStory = Effect.fn("OrderDatabase.failingApplicationStory")(function* (tell: (line: string) => void) {
	const database = yield* acquireDatabase;
	const failing = isolate(
		Effect.gen(function* () {
			tell("a story opens Alice's editor, saves an order over HTTP and then fails");
			const engine = yield* createApplication;
			const order = yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, database.sql));
			engine.orders.set("paper", order);
			yield* openScreen(engine, "paper", "editor");
			yield* settleOrders(engine, tell);
			yield* engine.alice["orders.save"]({ id: order.id, name: "Before failure", quantity: 9 });
			return yield* Effect.fail("intentional story failure");
		}),
	);
	const exit = yield* failing.pipe(Effect.provideService(StoryDatabase, database), Effect.exit);
	const next = yield* isolate(
		Effect.gen(function* () {
			tell("the next story seeds an order");
			const order = yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, database.sql));
			return order.id;
		}),
	).pipe(Effect.provideService(StoryDatabase, database));
	return {
		"failing story": Exit.isFailure(exit) ? "failed" : "passed",
		"next story's first order id": next,
		"open screens": activeScreens.size,
		"orders afterwards": (yield* database.observer`select id from orders`).length,
	};
});
