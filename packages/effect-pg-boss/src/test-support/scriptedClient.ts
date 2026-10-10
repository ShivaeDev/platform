import type { PgBossClient } from "#client.ts";

function unexpected(operation: string): never {
	throw new Error(`Unexpected pg-boss client call: ${operation}`);
}

export function scriptedClient(behavior: Partial<PgBossClient>): PgBossClient {
	return {
		createQueue: async () => unexpected("createQueue"),
		getQueue: async () => unexpected("getQueue"),
		off: () => unexpected("off"),
		offWork: async () => unexpected("offWork"),
		on: () => unexpected("on"),
		schedule: async () => unexpected("schedule"),
		send: async () => unexpected("send"),
		start: async () => unexpected("start"),
		stop: async () => unexpected("stop"),
		work: async () => unexpected("work"),
		...behavior,
	};
}
