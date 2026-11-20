import { Cause, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { queryPersistence } from "#adapters/queryPersistence.ts";
import { retainedQueries } from "#adapters/retainedQueries.ts";
import { querySignals, shareQuerySignals } from "#querySignals.ts";
import type { StoredForm } from "#storedQueries.ts";
import { wrapAtom } from "#wrapAtom.ts";

const runtimes = new WeakMap<Atom.Atom<unknown>, Atom.AtomRuntime<unknown, unknown>>();

export function queryRuntime(query: Atom.Atom<unknown>): Atom.AtomRuntime<unknown, unknown> | undefined {
	return runtimes.get(query);
}

const gone = Predicate.or(Predicate.isTagged("QueryReadDenied"), Predicate.isTagged("NotFound"));

export function retainQuery<A, E>(
	runtime: Atom.AtomRuntime<unknown, unknown>,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	stored?: StoredForm<A>,
) {
	const snapshot = Atom.make<Option.Option<AsyncResult.Success<A, E>>>(Option.none()).pipe(Atom.setIdleTTL(0));
	const signals = querySignals(atom);
	const retained = wrapAtom(atom, (get) => {
		get.mount(snapshot);
		const owner = get.once(retainedQueries);
		const persistence = stored === undefined ? undefined : get.once(queryPersistence);
		owner.take(retained);
		get.addFinalizer(() => {
			if (get.registry.getNodes().has(snapshot) && Option.isSome(get.registry.get(snapshot))) {
				owner.keep(retained, snapshot, runtime);
			}
		});
		if (stored !== undefined && persistence !== undefined && Option.isNone(get.once(snapshot))) {
			Option.map(persistence.restore(stored, runtime), (value) => get.set(snapshot, Option.some(AsyncResult.success<A, E>(value))));
		}
		function persist(result: AsyncResult.AsyncResult<A, E>) {
			if (stored === undefined || persistence === undefined || result.waiting) {
				return;
			}
			if (AsyncResult.isSuccess(result)) {
				persistence.save(stored, result.value, runtime);
			} else if (AsyncResult.isFailure(result) && Option.exists(Cause.findErrorOption(result.cause), gone)) {
				persistence.drop(stored, runtime);
			}
		}
		function display(result: AsyncResult.AsyncResult<A, E>) {
			if (AsyncResult.isSuccess(result) && !result.waiting) {
				get.set(snapshot, Option.some(result));
			}
			persist(result);
			const kept = AsyncResult.isInitial(result) ? get.once(snapshot) : Option.none<AsyncResult.Success<A, E>>();
			get.set(signals, { ...get.once(signals), retained: Option.isSome(kept) });
			return Option.match(kept, { onNone: () => result, onSome: AsyncResult.waiting });
		}
		const context = new Proxy(get, {
			get: (target, key, receiver) =>
				key === "setSelf" ? (value: AsyncResult.AsyncResult<A, E>) => get.setSelf(display(value)) : Reflect.get(target, key, receiver),
		});
		return display(atom.read(context));
	}).pipe(Atom.setIdleTTL(0));
	shareQuerySignals(retained, atom);
	runtimes.set(retained, runtime);
	return retained;
}
