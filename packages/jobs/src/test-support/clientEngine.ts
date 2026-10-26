import { EventEmitter } from "node:events";
import type { SqlClient } from "effect/sql";
import type { PgBossClientFactory } from "#client.ts";
import { FakeClient } from "#test/fakeClient.ts";

export function clientEngine(): {
	client: FakeClient;
	connectionString: string;
	events: EventEmitter;
	factory: PgBossClientFactory | undefined;
	logs: Array<{ logLevel: string; message: unknown }>;
	sql: SqlClient.SqlClient | undefined;
} {
	const client = new FakeClient();
	const logs: Array<{ logLevel: string; message: unknown }> = [];
	return {
		client,
		connectionString: "postgresql://compile-only",
		events: new EventEmitter(),
		factory: () => client,
		logs,
		sql: undefined,
	};
}
