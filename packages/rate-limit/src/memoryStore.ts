import { Clock, Effect, Layer } from "effect";
import { TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { Store, type WindowRequest } from "#Store.ts";

interface Window {
	count: number;
	readonly expiresAt: number;
}

export const memoryStore = Layer.effect(Store)(
	Effect.sync(() => {
		const windows = new Map<string, Window>();
		return {
			consume: Effect.fn("MemoryStore.consume")(function* ({ key, per, windowMillis }: WindowRequest) {
				const now = yield* Clock.currentTimeMillis;
				return yield* Effect.suspend(() => {
					for (const [name, entry] of windows) {
						if (entry.expiresAt <= now) {
							windows.delete(name);
						}
					}
					const entry = windows.get(key) ?? { count: 0, expiresAt: now + windowMillis };
					if (entry.count >= per) {
						return Effect.fail(new TooManyRequests({ key, message: "Rate limit exceeded", retryAt: entry.expiresAt }));
					}
					entry.count += 1;
					windows.set(key, entry);
					return Effect.void;
				});
			}),
		};
	}),
);
