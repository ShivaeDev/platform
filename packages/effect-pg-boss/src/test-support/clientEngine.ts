import { EventEmitter } from "node:events";
import type { PgBossClient } from "#client.ts";
import { FakeClient } from "#test/fakeClient.ts";

export function clientEngine() {
	const client = new FakeClient();
	const logs: Array<{ logLevel: string; message: unknown }> = [];
	return {
		client,
		connectionString: "postgresql://compile-only",
		events: new EventEmitter(),
		factory: (): PgBossClient => client,
		logs,
	};
}
