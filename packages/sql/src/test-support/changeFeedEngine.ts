import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Deferred, type Duration, Effect, Exit, Layer, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { type ListenerControls, type ListenerEvents, listenerEvents } from "./changeFeedListener.ts";
import type { copiesTables, documentsTable, generatedTable, readingsTable, rowsTable } from "./changeFeedTables.ts";
import { liveStreams } from "./liveStreams.ts";
import { postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";

export interface FeedTables {
	copies?: Effect.Success<typeof copiesTables>["copies"];
	documents?: Effect.Success<typeof documentsTable>;
	generated?: Effect.Success<typeof generatedTable>;
	readings?: Effect.Success<typeof readingsTable>;
	rows?: Effect.Success<typeof rowsTable>;
	sources?: Effect.Success<typeof copiesTables>["sources"];
}

export interface FeedTiming {
	readonly heartbeatInterval: Duration.Input;
	readonly heartbeatTimeout: Duration.Input;
	readonly retryDelay: Duration.Input;
}

export interface ChangeFeedEngine {
	readonly announced: string[];
	readonly applied: string[];
	binding: Context.Context<never> | undefined;
	readonly channel: string;
	readonly client: PgClient.PgClient;
	readonly controls: ListenerControls;
	readonly endings: string[];
	readonly events: ListenerEvents;
	readonly feedScope: Scope.Closeable;
	readonly ledger: string;
	readonly logs: RecordedLogs["Service"];
	readonly other: SqlClient.SqlClient;
	readonly reactivity: Reactivity.Reactivity;
	resyncs: number;
	readonly stalledCleanup: Effect.Effect<void>;
	readonly streams: ReturnType<typeof liveStreams>;
	readonly tables: FeedTables;
	timing: FeedTiming;
	readonly unreachable: PgClient.PgClient;
}

function ownedName(prefix: string) {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export const changeFeedEngine = Effect.fnUntraced(function* () {
	const client = yield* PgClient.PgClient;
	const stalledCleanup = yield* Deferred.make<void>();
	const feedScope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Effect.andThen(Deferred.succeed(stalledCleanup, undefined), Scope.close(feedScope, Exit.void)));
	const ledger = ownedName("feed_migrations");
	yield* Effect.addFinalizer(() =>
		Effect.forEach([ledger, `${ledger}_release`, `${ledger}_workers`], (name) => client`drop table if exists ${client(name)}`).pipe(Effect.orDie),
	);
	const engine: ChangeFeedEngine = {
		announced: [],
		applied: [],
		binding: undefined,
		channel: ownedName("feed"),
		client,
		controls: { cleanupStalls: false, history: [], muted: false, payloads: [], unreachable: false },
		endings: [],
		events: yield* listenerEvents,
		feedScope,
		ledger,
		logs: yield* RecordedLogs,
		other: Context.get(yield* Layer.build(Layer.fresh(postgresLayer)), SqlClient.SqlClient),
		reactivity: yield* Reactivity.Reactivity,
		resyncs: 0,
		stalledCleanup: Deferred.await(stalledCleanup),
		streams: liveStreams(),
		tables: {},
		timing: { heartbeatInterval: "5 seconds", heartbeatTimeout: "10 seconds", retryDelay: "1 second" },
		unreachable: yield* PgClient.make({ host: "127.0.0.1", port: 1 }),
	};
	return engine;
});
