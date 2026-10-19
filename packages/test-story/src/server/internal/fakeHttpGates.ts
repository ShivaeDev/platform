import { Deferred, Effect } from "effect";
import type { FakeHttpHold, FakeHttpRequest, FakeHttpScope } from "#fakeHttpService.ts";
import { fakeHttpSelection } from "#internal/fakeHttpSelection.ts";

export function fakeHttpGates(tell: (line: string) => void, kind: "hold" | "stall") {
	const gates = new Map<string, { enter: () => Promise<void>; release: () => void; matches: ReturnType<typeof fakeHttpSelection>["matches"] }>();
	return {
		close: () => {
			for (const gate of gates.values()) {
				gate.release();
			}
		},
		get: (route: string, request?: FakeHttpRequest) =>
			request ? [...gates.values()].find((gate) => gate.matches(route, request)) : gates.get(route),
		make: (route: string, scope?: FakeHttpScope): FakeHttpHold => {
			const selection = fakeHttpSelection(route, scope);
			const label = selection.label;
			if (gates.has(label)) {
				throw new Error(`Fake HTTP route "${route}" already has a ${kind}.\nhelp: Release its current ${kind} before scripting another.`);
			}
			const waiting = Deferred.makeUnsafe<void>();
			const released = Promise.withResolvers<void>();
			const gate = {
				enter: () => {
					tell(kind === "hold" ? `fake HTTP ${label} has a waiting request` : `fake HTTP ${label} body stalled`);
					Deferred.doneUnsafe(waiting, Effect.void);
					return released.promise;
				},
				matches: selection.matches,
				release: () => {
					if (gates.get(label) !== gate) {
						return;
					}
					gates.delete(label);
					released.resolve();
					tell(kind === "hold" ? `fake HTTP ${label} released` : `fake HTTP ${label} body released`);
				},
			};
			gates.set(label, gate);
			tell(kind === "hold" ? `fake HTTP ${label} held` : `fake HTTP ${label} body will stall`);
			return { release: Effect.sync(gate.release), waiting: Deferred.await(waiting) };
		},
	};
}
