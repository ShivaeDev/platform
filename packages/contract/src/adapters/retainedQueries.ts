import { Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { queryRetention } from "#queryRetention.ts";

export const retainedQueries = Atom.keepAlive(
	Atom.make((get) => {
		const idle = new Map<Atom.Atom<unknown>, { readonly release: () => void; readonly expire: () => void }>();
		get.addFinalizer(() => idle.clear());
		return {
			keep: <A>(query: Atom.Atom<unknown>, snapshot: Atom.Writable<Option.Option<A>>, runtime: Atom.AtomRuntime<unknown, unknown>) => {
				const { capacity = 100, timeToLive = "5 minutes" } = get.registry.get(queryRetention);
				const duration = Duration.fromInputUnsafe(timeToLive);
				if (capacity <= 0 || Duration.toMillis(duration) <= 0) {
					get.registry.set(snapshot, Option.none());
					return;
				}
				const registry = get.registry;
				const unmount = registry.mount(snapshot);
				function release() {
					idle.delete(query);
					stop();
					unmount();
				}
				function expire() {
					registry.set(snapshot, Option.none());
					release();
				}
				idle.set(query, { expire, release });
				const timer = Atom.make((context) => {
					const services = context(runtime);
					if (AsyncResult.isSuccess(services)) {
						context.addFinalizer(Effect.runCallbackWith(services.value)(Effect.sleep(duration).pipe(Effect.andThen(Effect.sync(expire)))));
					}
				}).pipe(Atom.setIdleTTL(0));
				const stop = registry.mount(timer);
				while (idle.size > capacity) {
					const oldest = idle.keys().next().value;
					if (oldest !== undefined) {
						idle.get(oldest)?.expire();
					}
				}
			},
			take: (atom: Atom.Atom<unknown>) => idle.get(atom)?.release(),
		};
	}),
);
