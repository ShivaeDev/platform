import { Effect, Stream, SubscriptionRef } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import { type Key, readKeys } from "./keys.ts";
import { type LiveStatus, live } from "./live.ts";
import { type ResumeWindow, resumeSignal } from "./resume.ts";
import type { changesRpc } from "./serverMetadata.ts";

declare const window: ResumeWindow | undefined;

export const LiveConnection = Symbol.for("@shivaedev/effect-contract/LiveConnection");
export interface LiveBound {
	readonly [LiveConnection]: { readonly connection: Atom.Atom<unknown>; readonly status: Atom.Atom<LiveStatus<unknown>> };
}

export type ChangesClient = AtomRpc.AtomRpcClient<unknown, string, ReturnType<typeof changesRpc>>;

export function automaticLive(service: ChangesClient, name: string) {
	const keys = Effect.runSync(SubscriptionRef.make<readonly Key[]>([]));
	const known = new Set<string>();
	function track(reads: readonly Key[]) {
		const fresh = reads.filter((key) => {
			const id = readKeys([key])[0] ?? "";
			if (known.has(id)) {
				return false;
			}
			known.add(id);
			return true;
		});
		if (fresh.length > 0) {
			Effect.runSync(SubscriptionRef.update(keys, (current) => [...current, ...fresh]));
		}
	}
	const subscription = live(service.runtime, {
		resume: resumeSignal(typeof window === "undefined" ? {} : { window }),
		resyncKeys: () => Effect.runSync(SubscriptionRef.get(keys)),
		stream: SubscriptionRef.changes(keys).pipe(
			Stream.switchMap((current) =>
				current.length === 0 ? Stream.never : Stream.unwrap(service.use((client) => Effect.succeed(client(`${name}.$changes`, { keys: current })))),
			),
		),
	});
	return { subscription, track };
}
