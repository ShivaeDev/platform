import { Effect } from "effect";
import { vi } from "vitest";
import type { PrismaClient } from "#test/generated/client.ts";

async function bind(client: PrismaClient) {
	vi.resetModules();
	const { makePrismaChanges } = await import("#changes.ts");
	return makePrismaChanges({ client, models: {}, name: "Same", publish: () => Effect.void });
}

export function separateCopies(client: PrismaClient) {
	return Effect.promise(async () => ({ first: await bind(client), second: await bind(client) }));
}
