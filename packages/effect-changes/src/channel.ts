import { Context, Effect, Exit } from "effect";
import { add, type Buffer, type Frame, keyed, makeBuffer, makeFrame, settled } from "./frame.ts";
import { type Observation, type Observer, unobserved } from "./observe.ts";
import { type Publish, type PublishFailure, publisher } from "./publish.ts";

export interface ChannelOptions<A, R> {
	readonly name: string;
	readonly owner: Effect.Effect<unknown, never, R>;
	readonly key?: (change: A) => unknown;
	readonly publish: Publish<A, R>;
	readonly onPublishFailure?: PublishFailure;
	readonly unowned?: Effect.Effect<void, never, R>;
}

export interface Channel<A, R> {
	readonly record: (changes: Iterable<A>) => Effect.Effect<void, never, R>;
	readonly within: <X, E, R2, E2, R3>(
		native: (body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E2, R3>,
	) => (body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E2, R | R3>;
	readonly open: Effect.Effect<Frame, never, R>;
	readonly batch: <X, E, R2>(body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E, R | R2>;
	readonly Sink: Context.Reference<Publish<A, R>>;
	readonly Observer: Context.Reference<Observer<A>>;
}

let channels = 0;

export const makeChannel = <A, R = never>(options: ChannelOptions<A, R>): Channel<A, R> => {
	const { name } = options;
	const prefix = `@shivaedev/effect-changes/${name}/${channels++}`;
	const Frames = Context.Reference<ReadonlyMap<unknown, Buffer<A>>>(`${prefix}/Frames`, { defaultValue: () => new Map() });
	const CurrentSink = Context.Reference<Publish<A, R>>(`${prefix}/Sink`, { defaultValue: () => options.publish });
	const CurrentObserver = Context.Reference<Observer<A>>(`${prefix}/Observer`, { defaultValue: () => unobserved });
	const keyOf = options.key ?? ((change: A): unknown => change);
	const publish = publisher<A, R>(name, options.onPublishFailure ?? "log");
	const guard = options.unowned ?? Effect.void;
	const unguarded = (frame: Buffer<A> | undefined) => frame === undefined || frame.kind === "batch";
	const observe = (observation: Observation<A>) => Effect.flatMap(Effect.service(CurrentObserver), (observer) => observer(observation));
	const deliver = (changes: ReadonlyArray<A>) =>
		Effect.andThen(
			observe({ _tag: "Published", changes }),
			Effect.flatMap(Effect.service(CurrentSink), (sink) => publish(sink, changes)),
		);

	const locate = Effect.gen(function* () {
		const owner = yield* options.owner;
		const frames = yield* Frames;
		return { owner, frames, frame: frames.get(owner) };
	});

	const record = Effect.fn("Changes.record")(function* (changes: Iterable<A>) {
		const { frame } = yield* locate;
		if (unguarded(frame)) yield* guard;
		const entries = keyed(changes, keyOf);
		if (frame !== undefined) yield* add(name, frame, entries);
		if (entries.size === 0) return;
		const distinct = [...entries.values()];
		yield* observe({ _tag: "Recorded", changes: distinct });
		if (frame === undefined) yield* deliver(distinct);
	});

	const openAs = (kind: Buffer<A>["kind"]) =>
		Effect.gen(function* () {
			const { owner, frames, frame: parent } = yield* locate;
			if (parent !== undefined && !parent.open) return yield* settled(name);
			if (kind === "transaction" && unguarded(parent)) yield* guard;
			const buffer = makeBuffer(kind, parent);
			const inner = new Map(frames).set(owner, buffer);
			const context = yield* Effect.context<R>();
			return makeFrame({
				name,
				buffer,
				provide: (body) => Effect.provideService(body, Frames, inner),
				publish: (changes) => Effect.provideContext(deliver(changes), context),
				discard: (changes) => Effect.provideContext(observe({ _tag: "Discarded", changes }), context),
			});
		});

	const open = openAs("transaction");

	const within: Channel<A, R>["within"] = (native) => (body) =>
		Effect.uninterruptibleMask((restore) =>
			Effect.flatMap(open, (frame) =>
				Effect.onExit(native(restore(frame.provide(body))), (exit) => frame.settle(Exit.isSuccess(exit) ? "committed" : "rolledBack")),
			),
		);

	const batch: Channel<A, R>["batch"] = (body) =>
		Effect.uninterruptibleMask((restore) =>
			Effect.flatMap(openAs("batch"), (frame) => Effect.onExit(restore(frame.provide(body)), () => frame.settle("committed"))),
		);

	return { record, within, open, batch, Sink: CurrentSink, Observer: CurrentObserver };
};
