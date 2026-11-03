import { Effect, Exit, Scope } from "effect";
import { routeOutbound } from "#server/routeOutbound.ts";
import { storyKit } from "#server/storyKit.ts";

const hostFetch = fetch;

const SLOTS = ["undici.globalDispatcher.1", "undici.globalDispatcher.2"];

interface Slot {
	readonly descriptor: PropertyDescriptor | undefined;
	readonly key: symbol;
	readonly origins: string[];
}

function dispatchThrough(slot: Slot, origin: string) {
	const current: unknown = Reflect.get(globalThis, slot.key);
	if (typeof current !== "object" || current === null || !("dispatch" in current) || typeof current.dispatch !== "function") {
		throw new Error("outbound dispatcher is missing");
	}
	current.dispatch({ origin }, {});
}

function recordingSlots() {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			await hostFetch("data:,");
			return SLOTS.map((name, index): Slot => {
				const key = Symbol.for(name);
				const origins: string[] = [];
				const slot = { descriptor: Object.getOwnPropertyDescriptor(globalThis, key), key, origins };
				Object.defineProperty(globalThis, key, {
					...(slot.descriptor ?? { configurable: true, writable: true }),
					value: {
						dispatch(options: { readonly origin: string }) {
							slot.origins.push(`slot ${index + 1} sent ${options.origin}`);
							return true;
						},
					},
				});
				return slot;
			});
		}),
		(slots) =>
			Effect.sync(() => {
				for (const slot of slots) {
					if (slot.descriptor === undefined) {
						Reflect.deleteProperty(globalThis, slot.key);
					} else {
						Object.defineProperty(globalThis, slot.key, slot.descriptor);
					}
				}
			}),
	);
}

export const dispatchers = storyKit({
	*create() {
		const slots = yield* recordingSlots();
		return { scope: yield* Scope.fork(yield* Scope.Scope), slots };
	},
	inspect: ({ slots }) => slots.map((slot) => slot.origins),
	name: "dispatchers",
	stages: [],
	verbs: ({ scope, slots }, story) => {
		function sends(origin: string) {
			for (const slot of slots) {
				dispatchThrough(slot, origin);
			}
		}
		return {
			endsRouting: (ending: "fails" | "succeeds") => {
				story.tell(`the routing scope ${ending}`);
				return Scope.close(scope, ending === "fails" ? Exit.fail("the routing scope fails") : Exit.void);
			},
			lastSent: () => Effect.sync(() => slots.map((slot) => slot.origins.at(-1))),
			opensRouting: () => {
				story.tell("a scope routes github.com to the local server");
				return routeOutbound({ "github.com": "http://127.0.0.1:4321" }, { passthrough: true }).pipe(Effect.provideService(Scope.Scope, scope));
			},
			sends: (origin: string) => {
				story.tell(`the application sends to ${origin}`);
				return Effect.sync(() => sends(origin));
			},
			sent: () => Effect.sync(() => slots.flatMap((slot) => slot.origins)),
		};
	},
});
