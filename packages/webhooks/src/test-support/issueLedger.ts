import { Context, Data, Deferred, Effect, Layer, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { webhookEvent, webhookJob } from "#server/registration.ts";
import { issueQueue } from "#test/fixture.ts";

export const LEDGER_KEY = "issue-ledger";

class LedgerUnavailable extends Data.TaggedError("LedgerUnavailable") {}
class LedgerEntryRefused extends Data.TaggedError("LedgerEntryRefused") {}

class IssueLedger extends Context.Service<IssueLedger, { readonly record: (issue: number) => Effect.Effect<void, LedgerUnavailable> }>()(
	"@shivaedev/webhooks/test/IssueLedger",
) {}

export interface LedgerWatch {
	readonly announced: string[];
	readonly firstAnnouncement: Deferred.Deferred<void>;
}

export function ledgerWatch(): LedgerWatch {
	return { announced: [], firstAnnouncement: Deferred.makeUnsafe<void>() };
}

export const issueLedger = Layer.effect(
	IssueLedger,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const reactivity = yield* Reactivity.Reactivity;
		return {
			record: (issue: number) =>
				sql`insert into webhook_ledger (issue) values (${issue})`.pipe(
					Effect.andThen(invalidateOnCommit([LEDGER_KEY])),
					transact({ onSqlError: () => new LedgerUnavailable() }),
					Effect.provideService(SqlClient.SqlClient, sql),
					Effect.provideService(Reactivity.Reactivity, reactivity),
				),
		};
	}),
);

export function ledgerListener(watch: LedgerWatch) {
	return Layer.effectDiscard(
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			yield* Effect.acquireRelease(
				Effect.sync(() =>
					reactivity.registerUnsafe([LEDGER_KEY], () => {
						watch.announced.push(LEDGER_KEY);
						Deferred.doneUnsafe(watch.firstAnnouncement, Effect.void);
					}),
				),
				(stop) => Effect.sync(stop),
			);
		}),
	);
}

const Payload = Schema.Struct({ issue: Schema.Struct({ number: Schema.Number }) });

export const ledgerEvents = {
	"ledger_issues": webhookEvent(Payload, ({ issue }) =>
		Effect.gen(function* () {
			const ledger = yield* IssueLedger;
			yield* ledger.record(issue.number);
			return [webhookJob(issueQueue, { number: issue.number })];
		}),
	),
	"ledger_refused_issues": webhookEvent(Payload, ({ issue }) =>
		Effect.gen(function* () {
			const ledger = yield* IssueLedger;
			yield* ledger.record(issue.number);
			return yield* new LedgerEntryRefused();
		}),
	),
};
