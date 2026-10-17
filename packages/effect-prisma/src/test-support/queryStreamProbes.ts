import { Effect, Semaphore, Stream } from "effect";
import type { DatabaseExecutor } from "#internal/executor.ts";
import { makeModelRelation } from "#internal/relation-runtime.ts";
import { ControlledCollection, EventStreamCollection } from "#test/controlled-collection.ts";
import { unusedClient } from "#test/unused-client.ts";

interface User {
	readonly id: number;
}
const rows: readonly User[] = [{ id: 1 }, { id: 2 }, { id: 3 }];

export function queryStreamProbes() {
	return {
		buffered: () =>
			Effect.gen(function* () {
				const events: string[] = [];
				interface StreamModels {
					readonly Lookup: ControlledCollection<User>;
					readonly Source: EventStreamCollection<User>;
				}
				const executor: DatabaseExecutor<StreamModels> = {
					client: unusedClient(),
					identity: {},
					liveness: {
						closedCode: "RUNTIME.TRANSACTION_CLOSED",
						open: true,
					},
					mode: "transaction",
					models: {
						Lookup: new ControlledCollection(() => {
							events.push("lookup");
							return Promise.resolve([...rows]);
						}),
						Source: new EventStreamCollection(rows, events),
					},
					querySemaphore: Semaphore.makeUnsafe(1),
					transactionIdentity: {},
					transactionSemaphore: undefined,
				};
				const source = makeModelRelation<EventStreamCollection<User>, StreamModels>(executor, "Source");
				const lookup = makeModelRelation<ControlledCollection<User>, StreamModels>(executor, "Lookup");

				const result = yield* Stream.runCollect(source.stream.pipe(Stream.mapEffect(() => lookup.exists())));

				const observedRows = result;
				const observedEvents = events;
				return { events: observedEvents, rows: observedRows };
			}),
		incremental: () =>
			Effect.gen(function* () {
				const events: string[] = [];
				interface StreamModels {
					readonly Source: EventStreamCollection<User>;
				}
				const executor: DatabaseExecutor<StreamModels> = {
					client: unusedClient(),
					identity: {},
					liveness: {
						closedCode: "RUNTIME.DATABASE_CLOSED",
						open: true,
					},
					mode: "root",
					models: { Source: new EventStreamCollection(rows, events) },
					querySemaphore: Semaphore.makeUnsafe(1),
					transactionIdentity: undefined,
					transactionSemaphore: undefined,
				};
				const source = makeModelRelation<EventStreamCollection<User>, StreamModels>(executor, "Source");

				const result = yield* Stream.runCollect(
					source.stream.pipe(
						Stream.map((row) => {
							events.push(`downstream:${row.id}`);
							return row;
						}),
					),
				);

				const observedRows = result;
				const observedEvents = events;
				return { events: observedEvents, rows: observedRows };
			}),
	};
}
