import type { PgBossClient } from "#client.ts";

export const testingRegistration = Symbol("jobs testing registration");

export function registerTestingQueue(client: PgBossClient, name: string) {
	const observe: unknown = Reflect.get(client, testingRegistration);
	if (typeof observe === "function") {
		observe(name);
	}
}
