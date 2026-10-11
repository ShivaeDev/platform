import { Effect } from "effect";

export type Outcome = "committed" | "rolledBack";

export interface Frame {
	readonly provide: <TValue, TError, TRequirements>(
		body: Effect.Effect<TValue, TError, TRequirements>,
	) => Effect.Effect<TValue, TError, TRequirements>;
	readonly settle: (outcome: Outcome) => Effect.Effect<void>;
}

export interface CommitFrame<E = never> extends Frame {
	readonly beforeCommit: Effect.Effect<void, E>;
}

export interface Buffer<A> {
	readonly changes: Map<unknown, A>;
	readonly kind: "transaction" | "batch";
	open: boolean;
	readonly parent: Buffer<A> | undefined;
}

export const makeBuffer = <A>(kind: Buffer<A>["kind"], parent: Buffer<A> | undefined): Buffer<A> => ({
	changes: new Map(),
	kind,
	open: true,
	parent,
});

export const settled = (name: string): Effect.Effect<never> =>
	Effect.die(new Error(`${name}: changes arrived after their transaction settled; record them before the transaction body returns`));

export const add = <A>(name: string, buffer: Buffer<A>, entries: Iterable<readonly [unknown, A]>): Effect.Effect<void> =>
	buffer.open
		? Effect.sync(() => {
				for (const [key, change] of entries) {
					if (!buffer.changes.has(key)) {
						buffer.changes.set(key, change);
					}
				}
			})
		: settled(name);

export const keyed = <A>(changes: Iterable<A>, keyOf: (change: A) => unknown): Map<unknown, A> => {
	const entries = new Map<unknown, A>();
	for (const change of changes) {
		const key = keyOf(change);
		if (!entries.has(key)) {
			entries.set(key, change);
		}
	}
	return entries;
};

function transactionParent<A>(buffer: Buffer<A> | undefined): boolean {
	return buffer !== undefined && (buffer.kind === "transaction" || transactionParent(buffer.parent));
}

export const makeFrame = <A, E = never>(options: {
	readonly beforeCommit?: (changes: readonly A[]) => Effect.Effect<void, E>;
	readonly name: string;
	readonly buffer: Buffer<A>;
	readonly provide: <TValue, TError, TRequirements>(
		body: Effect.Effect<TValue, TError, TRequirements>,
	) => Effect.Effect<TValue, TError, TRequirements>;
	readonly publish: (changes: readonly A[]) => Effect.Effect<void>;
	readonly discard: (changes: readonly A[]) => Effect.Effect<void>;
}): CommitFrame<E> => {
	const { name, buffer } = options;
	const settle = Effect.fn("Changes.settle")(function* (outcome: Outcome) {
		if (!buffer.open) {
			return;
		}
		buffer.open = false;
		if (outcome === "committed" && buffer.parent !== undefined) {
			return yield* add(name, buffer.parent, buffer.changes);
		}
		const changes = [...buffer.changes.values()];
		if (changes.length === 0) {
			return;
		}
		yield* outcome === "committed" ? options.publish(changes) : options.discard(changes);
	}, Effect.uninterruptible);
	const beforeCommit = Effect.suspend(() => {
		if (!buffer.open) {
			return settled(name);
		}
		if (buffer.kind !== "transaction" || transactionParent(buffer.parent) || buffer.changes.size === 0) {
			return Effect.void;
		}
		return options.beforeCommit?.([...buffer.changes.values()]) ?? Effect.void;
	});
	return { beforeCommit, provide: options.provide, settle };
};
