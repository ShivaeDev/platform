import { Effect } from "effect";

export type Outcome = "committed" | "rolledBack";

export interface Frame {
	readonly provide: <X, E, R>(body: Effect.Effect<X, E, R>) => Effect.Effect<X, E, R>;
	readonly settle: (outcome: Outcome) => Effect.Effect<void>;
}

export interface Buffer<A> {
	readonly kind: "transaction" | "batch";
	readonly changes: Map<unknown, A>;
	readonly parent: Buffer<A> | undefined;
	open: boolean;
}

export const makeBuffer = <A>(kind: Buffer<A>["kind"], parent: Buffer<A> | undefined): Buffer<A> => ({
	kind,
	changes: new Map(),
	parent,
	open: true,
});

export const settled = (name: string): Effect.Effect<never> =>
	Effect.die(new Error(`${name}: changes arrived after their transaction settled; record them before the transaction body returns`));

export const add = <A>(name: string, buffer: Buffer<A>, entries: Iterable<readonly [unknown, A]>): Effect.Effect<void> =>
	buffer.open
		? Effect.sync(() => {
				for (const [key, change] of entries) if (!buffer.changes.has(key)) buffer.changes.set(key, change);
			})
		: settled(name);

export const keyed = <A>(changes: Iterable<A>, keyOf: (change: A) => unknown): Map<unknown, A> => {
	const entries = new Map<unknown, A>();
	for (const change of changes) {
		const key = keyOf(change);
		if (!entries.has(key)) entries.set(key, change);
	}
	return entries;
};

export const makeFrame = <A>(options: {
	readonly name: string;
	readonly buffer: Buffer<A>;
	readonly provide: <X, E, R>(body: Effect.Effect<X, E, R>) => Effect.Effect<X, E, R>;
	readonly publish: (changes: ReadonlyArray<A>) => Effect.Effect<void>;
	readonly discard: (changes: ReadonlyArray<A>) => Effect.Effect<void>;
}): Frame => {
	const { name, buffer } = options;
	const settle = Effect.fn("Changes.settle")(function* (outcome: Outcome) {
		if (!buffer.open) return;
		buffer.open = false;
		if (outcome === "committed" && buffer.parent !== undefined) return yield* add(name, buffer.parent, buffer.changes);
		const changes = [...buffer.changes.values()];
		if (changes.length === 0) return;
		yield* outcome === "committed" ? options.publish(changes) : options.discard(changes);
	}, Effect.uninterruptible);
	return { provide: options.provide, settle };
};
