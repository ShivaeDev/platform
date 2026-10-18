import { Context, Effect, Exit } from "effect";
import { add, type Buffer, type CommitFrame, keyed, makeBuffer, makeFrame, settled } from "./frame.ts";
import { type Observation, type Observer, unobserved } from "./observe.ts";
import { type Publish, type PublishFailure, publisher } from "./publish.ts";

export type BeforeCommit<A, E = never, R = never> = (changes: readonly A[]) => Effect.Effect<void, E, R>;

export interface ChannelOptions<A, R, E = never> {
	readonly beforeCommit?: BeforeCommit<A, E, R>;
	readonly key?: (change: A) => unknown;
	readonly name: string;
	readonly onPublishFailure?: PublishFailure;
	readonly owner: Effect.Effect<unknown, never, R>;
	readonly publish: Publish<A, R>;
	readonly unowned?: Effect.Effect<void, never, R>;
}

export interface Channel<A, R, THookError = never> {
	readonly BeforeCommit: Context.Reference<BeforeCommit<A, THookError, R>>;
	readonly batch: <X, E, TBodyRequirements>(body: Effect.Effect<X, E, TBodyRequirements>) => Effect.Effect<X, E, R | TBodyRequirements>;
	readonly CommittedSink: Context.Reference<Publish<A, R> | undefined>;
	readonly Observer: Context.Reference<Observer<A>>;
	readonly open: Effect.Effect<CommitFrame<THookError>, never, R>;
	readonly record: (changes: Iterable<A>) => Effect.Effect<void, never, R>;
	readonly Sink: Context.Reference<Publish<A, R>>;
	readonly within: <X, E, TBodyRequirements, TNativeError, TNativeRequirements>(
		native: (body: Effect.Effect<X, E | THookError, TBodyRequirements>) => Effect.Effect<X, TNativeError, TNativeRequirements>,
	) => (body: Effect.Effect<X, E, TBodyRequirements>) => Effect.Effect<X, TNativeError, R | TNativeRequirements>;
}

let channels = 0;

export const makeChannel = <A, R = never, THookError = never>(options: ChannelOptions<A, R, THookError>): Channel<A, R, THookError> => {
	const { name } = options;
	const prefix = `@shivaedev/effect-changes/${name}/${channels}`;
	channels += 1;
	const Frames = Context.Reference<ReadonlyMap<unknown, Buffer<A>>>(`${prefix}/Frames`, { defaultValue: () => new Map() });
	const BeforeCommit = Context.Reference<BeforeCommit<A, THookError, R>>(`${prefix}/BeforeCommit`, {
		defaultValue: () => options.beforeCommit ?? (() => Effect.void),
	});
	const CommittedSink = Context.Reference<Publish<A, R> | undefined>(`${prefix}/CommittedSink`, { defaultValue: () => undefined });
	const CurrentSink = Context.Reference<Publish<A, R>>(`${prefix}/Sink`, { defaultValue: () => options.publish });
	const CurrentObserver = Context.Reference<Observer<A>>(`${prefix}/Observer`, { defaultValue: () => unobserved });
	const keyOf = options.key ?? ((change: A): unknown => change);
	const publish = publisher<A, R>(name, options.onPublishFailure ?? "log");
	const guard = options.unowned ?? Effect.void;
	function unguarded(frame: Buffer<A> | undefined) {
		return frame === undefined || frame.kind === "batch";
	}
	function observe(observation: Observation<A>) {
		return Effect.flatMap(Effect.service(CurrentObserver), (observer) => observer(observation));
	}
	function deliver(changes: readonly A[], committed = false) {
		return Effect.andThen(
			observe({ _tag: "Published", changes }),
			Effect.gen(function* () {
				const override = committed ? yield* CommittedSink : undefined;
				yield* publish(override ?? (yield* CurrentSink), changes);
			}),
		);
	}

	const locate = Effect.gen(function* () {
		const owner = yield* options.owner;
		const frames = yield* Frames;
		return { frame: frames.get(owner), frames, owner };
	});

	const record = Effect.fn("Changes.record")(function* (changes: Iterable<A>) {
		const { frame } = yield* locate;
		if (unguarded(frame)) {
			yield* guard;
		}
		const entries = keyed(changes, keyOf);
		if (frame !== undefined) {
			yield* add(name, frame, entries);
		}
		if (entries.size === 0) {
			return;
		}
		const distinct = [...entries.values()];
		yield* observe({ _tag: "Recorded", changes: distinct });
		if (frame === undefined) {
			yield* deliver(distinct);
		}
	});

	function openAs(kind: Buffer<A>["kind"]) {
		return Effect.gen(function* () {
			const { owner, frames, frame: parent } = yield* locate;
			if (parent !== undefined && !parent.open) {
				return yield* settled(name);
			}
			if (kind === "transaction" && unguarded(parent)) {
				yield* guard;
			}
			const buffer = makeBuffer(kind, parent);
			const inner = new Map(frames).set(owner, buffer);
			const context = yield* Effect.context<R>();
			return makeFrame({
				beforeCommit: (changes) =>
					Effect.updateContext<void, THookError, R, never>(
						Effect.flatMap(Effect.service(BeforeCommit), (hook) => hook(changes)),
						(current: Context.Context<never>) => Context.merge(context, current),
					),
				buffer,
				discard: (changes) => Effect.provideContext(observe({ _tag: "Discarded", changes }), context),
				name,
				provide: (body) => Effect.provideService(body, Frames, inner),
				publish: (changes) => Effect.provideContext(deliver(changes, kind === "transaction"), context),
			});
		});
	}

	const open = openAs("transaction");

	const within: Channel<A, R, THookError>["within"] = (native) => (body) =>
		Effect.uninterruptibleMask((restore) =>
			Effect.flatMap(open, (frame) =>
				Effect.onExit(native(restore(frame.provide(Effect.tap(body, () => frame.beforeCommit)))), (exit) =>
					frame.settle(Exit.isSuccess(exit) ? "committed" : "rolledBack"),
				),
			),
		);

	const batch: Channel<A, R, THookError>["batch"] = (body) =>
		Effect.uninterruptibleMask((restore) =>
			Effect.flatMap(openAs("batch"), (frame) => Effect.onExit(restore(frame.provide(body)), () => frame.settle("committed"))),
		);

	return { BeforeCommit, batch, CommittedSink, Observer: CurrentObserver, open, record, Sink: CurrentSink, within };
};
