import { EventEmitter } from "node:events";
import { Redacted, type Tracer } from "effect";
import type { SqlClient } from "effect/sql";
import type { PgBossClientFactory } from "#client.ts";
import { FakeClient } from "#test/fakeClient.ts";

export function clientEngine(): {
	client: FakeClient;
	connectionString: Redacted.Redacted<string>;
	events: EventEmitter;
	factory: PgBossClientFactory | undefined;
	workerLogs: Array<{ message: unknown; span: Tracer.AnySpan | undefined; annotations: Readonly<Record<string, unknown>> }>;
	logs: Array<{ logLevel: string; message: unknown; cause?: string }>;
	sql: SqlClient.SqlClient | undefined;
} {
	const client = new FakeClient();
	const logs: Array<{ logLevel: string; message: unknown; cause?: string }> = [];
	return {
		client,
		connectionString: Redacted.make("postgresql://compile-only"),
		events: new EventEmitter(),
		factory: () => client,
		logs,
		sql: undefined,
		workerLogs: [],
	};
}
