import { Data, Effect, type Schema, Semaphore } from "effect";
import { draftCodec } from "#adapters/draftCodec.ts";
import type { DraftOperation, PersistedDraftConfig, Persistence } from "#persistence.ts";

class DraftStorageUnavailable extends Data.TaggedError("DraftStorageUnavailable")<{ readonly cause: unknown }> {}

function operation<A>(run: () => DraftOperation<A>): Effect.Effect<A, DraftStorageUnavailable> {
	return Effect.suspend(() => {
		const value = run();
		return Effect.isEffect(value) ? value : Effect.succeed(value);
	}).pipe(Effect.catchCause((cause) => Effect.fail(new DraftStorageUnavailable({ cause }))));
}

export function persistence<TSchema extends Schema.Constraint>(schema: TSchema, config: PersistedDraftConfig): Persistence<TSchema["Encoded"]> {
	const codec = draftCodec(schema, config);
	const serial = Semaphore.makeUnsafe(1);
	let revision: { value: string | undefined } = { value: undefined };
	function active() {
		return config.session?.active !== false;
	}
	function run(effect: Effect.Effect<unknown, DraftStorageUnavailable>) {
		return Effect.runCallback(serial.withPermit(effect).pipe(Effect.catchTag("DraftStorageUnavailable", () => Effect.void)));
	}
	function clear(expected = revision.value) {
		if (expected !== undefined) {
			run(operation(() => config.storage().removeItem(config.key, expected)));
		}
	}
	function read(raw: string | null) {
		try {
			return { values: raw === null ? undefined : codec.read(raw) };
		} catch {
			if (raw !== null) {
				clear(raw);
			}
			return undefined;
		}
	}
	config.session?.track(config.key, () =>
		run(
			Effect.gen(function* () {
				const storage = yield* operation(config.storage);
				const raw = yield* operation(() => storage.getItem(config.key));
				if (raw !== null) {
					yield* operation(() => codec.read(raw));
					yield* operation(() => storage.removeItem(config.key, raw));
				}
			}),
		),
	);
	return {
		clear: (expected = revision.value) => {
			if (active()) {
				clear(expected);
			}
		},
		observe: (receive) => {
			let stopped = false;
			let changes = 0;
			function changed(raw: string | null, loaded = false) {
				if (stopped || !active()) {
					return;
				}
				if (!loaded && revision.value === (raw ?? undefined)) {
					return;
				}
				const parsed = read(raw);
				if (parsed && receive(parsed.values)) {
					revision = { value: raw ?? undefined };
				}
			}
			let unsubscribe: (() => void) | undefined;
			const stop = Effect.runCallback(
				Effect.gen(function* () {
					if (!active()) {
						return;
					}
					const storage = yield* operation(config.storage);
					unsubscribe = yield* operation(() =>
						storage.subscribe?.(config.key, (incoming) => {
							changes += 1;
							changed(incoming);
						}),
					);
					const before = changes;
					const captured = revision;
					const raw = yield* operation(() => storage.getItem(config.key));
					if (before === changes && captured === revision) {
						changed(raw, true);
					}
				}).pipe(Effect.catchTag("DraftStorageUnavailable", () => Effect.void)),
			);
			return () => {
				stopped = true;
				unsubscribe?.();
				stop();
			};
		},
		revision: () => {
			const captured = revision;
			return () => captured.value;
		},
		write: (baseline, values, edited, sameInput) => {
			if (!active()) {
				return;
			}
			try {
				const expected = sameInput ? revision.value : undefined;
				const raw = codec.write(baseline, values, edited);
				if (sameInput) {
					revision.value = raw;
				} else {
					revision = { value: raw };
				}
				run(operation(() => (active() ? config.storage().setItem(config.key, raw, expected) : undefined)));
			} catch {
				clear();
			}
		},
	};
}
