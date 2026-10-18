import { Deferred, Effect } from "effect";
import type { FakeHttpHold } from "#fakeHttpService.ts";

export function fakeHttpGates(tell: (line: string) => void, kind: "hold" | "stall") {
	const gates = new Map<string, { enter: () => Promise<void>; release: () => void }>();
	return {
		close: () => {
			for (const gate of gates.values()) {
				gate.release();
			}
		},
		get: (route: string) => gates.get(route),
		make: (route: string): FakeHttpHold => {
			if (gates.has(route)) {
				throw new Error(`Fake HTTP route "${route}" already has a ${kind}.\nhelp: Release its current ${kind} before scripting another.`);
			}
			const waiting = Deferred.makeUnsafe<void>();
			const released = Promise.withResolvers<void>();
			const gate = {
				enter: () => {
					tell(kind === "hold" ? `fake HTTP ${route} has a waiting request` : `fake HTTP ${route} body stalled`);
					Deferred.doneUnsafe(waiting, Effect.void);
					return released.promise;
				},
				release: () => {
					if (gates.get(route) !== gate) {
						return;
					}
					gates.delete(route);
					released.resolve();
					tell(kind === "hold" ? `fake HTTP ${route} released` : `fake HTTP ${route} body released`);
				},
			};
			gates.set(route, gate);
			tell(kind === "hold" ? `fake HTTP ${route} held` : `fake HTTP ${route} body will stall`);
			return { release: Effect.sync(gate.release), waiting: Deferred.await(waiting) };
		},
	};
}
