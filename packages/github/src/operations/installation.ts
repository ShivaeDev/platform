import type { Context } from "effect";
import { Cache, Effect } from "effect";
import type { GitHub } from "#GitHub.ts";

export function installation(clients: Cache.Cache<number, Context.Service.Shape<typeof GitHub>>) {
	return (id: number) => Cache.get(clients, id).pipe(Effect.tap((client) => Cache.set(clients, id, client)));
}
