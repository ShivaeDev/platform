import type { PgBossClient } from "#client.ts";

function unexpected(operation: string): never {
	throw new Error(`Unexpected pg-boss client call: ${operation}`);
}

export function scriptedClient(behavior: Partial<PgBossClient>): PgBossClient {
	return {
		complete: async () => unexpected("complete"),
		createQueue: async () => unexpected("createQueue"),
		fail: async () => unexpected("fail"),
		getQueue: async () => unexpected("getQueue"),
		off: () => undefined,
		offWork: async () => unexpected("offWork"),
		on: () => undefined,
		schedule: async () => unexpected("schedule"),
		send: async () => unexpected("send"),
		start: async () => undefined,
		stop: async () => undefined,
		work: async () => unexpected("work"),
		...behavior,
	};
}
