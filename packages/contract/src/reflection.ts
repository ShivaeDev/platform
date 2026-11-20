import { Effect, Queue } from "effect";
import { clientId } from "#adapters/clientId.ts";

export interface FollowedStream {
	armedAt: number | undefined;
	supported: boolean | undefined;
}

interface Wait {
	readonly after: number;
	readonly own: number | undefined;
	readonly reflected: () => void;
	readonly streams: Set<FollowedStream>;
}

// One per connection: every command and live stream that shares it folds into the same tokens.
// The record is mutable state that commands and streams drive synchronously, so building it is a side effect.
export const makeReflection = Effect.flatMap(Queue.sliding<void>(1), (catchUps) =>
	Effect.sync(() => {
		const client = clientId();
		let issued = 0;
		const streams = new Set<FollowedStream>();
		const flights = new Map<number, Set<FollowedStream>>();
		const waits = new Set<Wait>();

		// A stream armed after the command's token was issued may have registered behind it, so only a later token proves it caught up.
		function uncertain(wait: Wait, stream: FollowedStream) {
			return stream.armedAt !== undefined && (wait.own === undefined || stream.armedAt >= wait.own);
		}
		function release(covers: (wait: Wait, stream: FollowedStream) => boolean, stream?: FollowedStream) {
			for (const wait of [...waits]) {
				const covered = [...wait.streams].filter((waited) => (stream === undefined || waited === stream) && covers(wait, waited));
				for (const waited of covered) {
					wait.streams.delete(waited);
				}
				if (wait.streams.size === 0 && waits.delete(wait)) {
					wait.reflected();
				}
			}
		}
		function token() {
			issued += 1;
			return issued;
		}
		function flight() {
			const own = token();
			flights.set(own, new Set());
			return own;
		}
		return {
			abandon: () => release(uncertain),
			accepted: (own: number | undefined, reflected: () => void) => {
				const confirmed = own === undefined ? undefined : flights.get(own);
				if (own !== undefined) {
					flights.delete(own);
				}
				const waited = [...streams].filter((stream) => stream.supported !== false && confirmed?.has(stream) !== true);
				if (waited.length === 0) {
					reflected();
					return;
				}
				const wait: Wait = { after: issued, own, reflected, streams: new Set(waited) };
				waits.add(wait);
				if (waited.some((stream) => uncertain(wait, stream))) {
					Queue.offerUnsafe(catchUps, undefined);
				}
			},
			armed: (stream: FollowedStream) => {
				stream.supported = true;
				stream.armedAt = issued;
				if ([...waits].some((wait) => wait.streams.has(stream))) {
					Queue.offerUnsafe(catchUps, undefined);
				}
			},
			catchUps,
			client,
			confirmed: (stream: FollowedStream, ids: readonly number[]) => {
				for (const id of ids) {
					flights.get(id)?.add(stream);
				}
				release((wait) => ids.some((id) => id === wait.own || id > wait.after), stream);
			},
			data: (stream: FollowedStream) => {
				if (stream.supported === undefined) {
					stream.supported = false;
					release(() => true, stream);
				}
			},
			detach: (stream: FollowedStream) => {
				streams.delete(stream);
				release(() => true, stream);
			},
			failed: (own: number | undefined) => {
				if (own !== undefined) {
					flights.delete(own);
				}
			},
			flight,
			opening: (stream: FollowedStream) => {
				stream.armedAt = undefined;
				stream.supported = undefined;
				streams.add(stream);
			},
			send: (piggyback: boolean) => (piggyback && [...streams].some((stream) => stream.supported !== false) ? flight() : undefined),
			token,
		};
	}),
);

export type Reflection = Effect.Success<typeof makeReflection>;

export const reflections = new WeakMap<object, { readonly piggyback: boolean; readonly reflection: Reflection }>();
