import { Effect, Queue } from "effect";
import { clientId } from "#adapters/clientId.ts";

interface StreamState {
	armedAt: number | undefined;
	supported: boolean | undefined;
}

interface Wait {
	readonly after: number;
	readonly own: number | undefined;
	readonly reflected: () => void;
	readonly streams: Set<object>;
}

// One per connection: every command and live stream that shares it folds into the same tokens.
export const makeReflection = Effect.gen(function* () {
	const catchUps = yield* Queue.sliding<void>(1);
	const client = clientId();
	let issued = 0;
	const streams = new Map<object, StreamState>();
	const flights = new Map<number, Set<object>>();
	const waits = new Set<Wait>();

	// A stream armed after the command's token was issued may have registered behind it, so only a later token proves it caught up.
	function uncertain(wait: Wait, stream: object) {
		const armedAt = streams.get(stream)?.armedAt;
		return armedAt !== undefined && (wait.own === undefined || armedAt >= wait.own);
	}
	function release(covers: (wait: Wait, stream: object) => boolean, stream?: object) {
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
			const waited = [...streams].filter(([stream, state]) => state.supported !== false && confirmed?.has(stream) !== true);
			if (waited.length === 0) {
				reflected();
				return;
			}
			const wait: Wait = { after: issued, own, reflected, streams: new Set(waited.map(([stream]) => stream)) };
			waits.add(wait);
			if (waited.some(([stream]) => uncertain(wait, stream))) {
				Queue.offerUnsafe(catchUps, undefined);
			}
		},
		armed: (stream: object) => {
			const state = streams.get(stream);
			if (state === undefined) {
				return;
			}
			state.supported = true;
			state.armedAt = issued;
			if ([...waits].some((wait) => wait.streams.has(stream))) {
				Queue.offerUnsafe(catchUps, undefined);
			}
		},
		catchUps,
		client,
		confirmed: (stream: object, ids: readonly number[]) => {
			for (const id of ids) {
				flights.get(id)?.add(stream);
			}
			release((wait) => ids.some((id) => id === wait.own || id > wait.after), stream);
		},
		data: (stream: object) => {
			const state = streams.get(stream);
			if (state?.supported === undefined && state !== undefined) {
				state.supported = false;
				release(() => true, stream);
			}
		},
		detach: (stream: object) => {
			streams.delete(stream);
			release(() => true, stream);
		},
		failed: (own: number | undefined) => {
			if (own !== undefined) {
				flights.delete(own);
			}
		},
		flight,
		opening: (stream: object) => {
			streams.set(stream, { armedAt: undefined, supported: undefined });
		},
		send: (piggyback: boolean) => (piggyback && [...streams.values()].some((state) => state.supported !== false) ? flight() : undefined),
		token,
	};
});

export type Reflection = Effect.Success<typeof makeReflection>;

export const reflections = new WeakMap<object, { readonly piggyback: boolean; readonly reflection: Reflection }>();
