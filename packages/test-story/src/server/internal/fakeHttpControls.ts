import { Deferred, Effect } from "effect";
import type { FakeHttpHold, FakeHttpReply } from "#fakeHttpService.ts";

export function fakeHttpControls(tell: (line: string) => void) {
	const failures = new Map<string, FakeHttpReply[]>();
	const holds = new Map<string, { readonly enter: () => Promise<void>; readonly release: () => void }>();
	return {
		close: () => {
			for (const hold of holds.values()) {
				hold.release();
			}
		},
		failOnce: (route: string, reply: FakeHttpReply) =>
			Effect.sync(() => {
				const queue = failures.get(route) ?? [];
				queue.push(reply);
				failures.set(route, queue);
				tell(`fake HTTP ${route} will answer once with ${reply.status ?? 200}`);
			}),
		hold: (route: string): Effect.Effect<FakeHttpHold> =>
			Effect.sync(() => {
				if (holds.has(route)) {
					throw new Error(`Fake HTTP route "${route}" is already held.\nhelp: Release its current hold before holding the route again.`);
				}
				const waiting = Deferred.makeUnsafe<void>();
				const released = Promise.withResolvers<void>();
				const hold = {
					enter: () => {
						tell(`fake HTTP ${route} has a waiting request`);
						Deferred.doneUnsafe(waiting, Effect.void);
						return released.promise;
					},
					release: () => {
						if (holds.get(route) !== hold) {
							return;
						}
						holds.delete(route);
						released.resolve();
						tell(`fake HTTP ${route} released`);
					},
				};
				holds.set(route, hold);
				tell(`fake HTTP ${route} held`);
				return { release: Effect.sync(hold.release), waiting: Deferred.await(waiting) };
			}),
		pause: async (route: string) => {
			await holds.get(route)?.enter();
		},
		takeFailure: (route: string) => failures.get(route)?.shift(),
	};
}
