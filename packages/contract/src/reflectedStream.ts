import { Effect, Exit, Stream } from "effect";
import { Headers } from "effect/http";
import { retriesLive } from "#liveRetry.ts";
import { type FollowedStream, type Reflection, reflections } from "#reflection.ts";
import { streamSyncHeaders } from "#syncHeader.ts";

export interface StreamAnchor extends FollowedStream {
	mounted: boolean;
	reflection: Reflection | undefined;
}

export interface ReflectionFollower {
	readonly armed: () => void;
	readonly confirmed: (ids: readonly number[]) => void;
	readonly data: () => void;
}

// A mounted query keeps one place in its connection's waits across attempts; it leaves only when it unmounts or stops retrying.
export function followReflection(client: object, anchor: StreamAnchor) {
	const reflection = reflections.get(client)?.reflection;
	if (reflection === undefined) {
		return undefined;
	}
	const follower: ReflectionFollower = {
		armed: () => reflection.armed(anchor),
		confirmed: (ids) => reflection.confirmed(anchor, ids),
		data: () => reflection.data(anchor),
	};
	return {
		follower,
		headers: (headers: Headers.Input | undefined) =>
			Headers.merge(Headers.fromInput(headers), Headers.fromInput(streamSyncHeaders(reflection.client))),
		lifetime: <A, E, R>(stream: Stream.Stream<A, E, R>) =>
			stream.pipe(
				Stream.onStart(
					Effect.sync(() => {
						anchor.reflection = reflection;
						if (anchor.mounted) {
							reflection.opening(anchor);
						}
					}),
				),
				Stream.onExit((exit) =>
					Effect.sync(() => {
						if (anchor.mounted && (Exit.isSuccess(exit) || retriesLive(exit.cause))) {
							reflection.opening(anchor);
						} else {
							reflection.detach(anchor);
						}
					}),
				),
			),
	};
}
