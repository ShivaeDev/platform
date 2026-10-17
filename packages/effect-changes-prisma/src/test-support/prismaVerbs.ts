import { Effect } from "effect";
import { configuredTimeout } from "#expiry.ts";
import type { TransactionOptions } from "#model.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import { makeChanges } from "./changes.ts";
import { committing } from "./committing.ts";
import { coverageOf } from "./coverageHarness.ts";
import { type ConnectOptions, connect, orderIds } from "./database.ts";
import type { HarnessTx } from "./expiry.ts";
import { harnessed, timed, warm } from "./expiry.ts";
import type { PrismaEngine } from "./prismaEngine.ts";
import { reusedConnection } from "./reusedConnection.ts";
import { separateCopies } from "./separateCopies.ts";

export function prismaVerbs(engine: PrismaEngine, tell: (line: string) => void) {
	const { binding, client, observer, schema, execute, seen } = engine;
	const { changes, observe, observations, unnamed } = binding;
	function use<A>(run: Parameters<typeof changes.use<A>>[0]) {
		return Effect.suspend(() => {
			tell("the application calls Prisma through its change binding");
			return changes.use(run);
		});
	}
	function transaction<A, E, R>(body: Effect.Effect<A, E, R>, options: TransactionOptions | undefined = engine.options) {
		return Effect.suspend(() => {
			tell("the application runs a binding transaction");
			return changes.transaction(body, options);
		});
	}
	return {
		*anotherBinding(options?: ConnectOptions) {
			const other = yield* connect(schema, options);
			return { client: other, ...makeChanges(other) };
		},
		changes,
		client,
		committing: (pid: number) => committing(observer, pid),
		copies: () => separateCopies(client),
		coverageOf: <A, E>(body: Effect.Effect<A, E>) => {
			tell("the coverage harness compares PostgreSQL writes with recorded changes, then rolls back");
			return coverageOf(engine, body);
		},
		execute,
		*expires(current = client) {
			tell("the transaction deadline stops a waiting body");
			yield* warm(current);
			return yield* timed(
				Effect.flip(
					transaction(engine.probe.body(use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })))).pipe(
						Effect.provideService(changes.Client, current),
					),
				),
			);
		},
		harnessed: <A, E>(body: Effect.Effect<A, E>) => harnessed(changes, body),
		observations,
		observe,
		observer,
		order: (id: string, ownerId = "ada", total = 1) => use((db) => db.order.create({ data: { id, ownerId, total } })),
		orderIds: () => {
			tell("an independent connection reads the committed orders");
			return orderIds(observer);
		},
		probe: engine.probe,
		published: () => {
			tell("the application reads its published change batches");
			return binding.published;
		},
		recordClientWrite: <A>(model: string, operation: string, run: (db: PrismaClient) => Promise<A>) =>
			Effect.gen(function* () {
				tell(`the application's own client runs ${model}.${operation} and records its result`);
				const result = yield* Effect.promise(() => run(client));
				yield* observe(changes.recordWrite({ model, operation, result }));
				return result;
			}),
		reusedConnection: <A>(later: (tx: HarnessTx) => Promise<A>) => reusedConnection(client, later),
		schema,
		seen,
		tableModels: () => Effect.sync(() => [...(engine.coverage?.tables ?? [])]),
		timeoutOf: (current: object = client) => Effect.sync(() => configuredTimeout(current)),
		transaction,
		unnamed,
		use,
	};
}
