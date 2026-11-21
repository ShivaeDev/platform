import type * as Atom from "effect/reactivity/Atom";
import type { QueryOptions, RunOptions } from "#Bound.ts";
import { runSubject } from "#clientOperations.ts";

interface Operation {
	readonly query?: (payload: unknown, options?: QueryOptions) => unknown;
	readonly run: (payload: unknown, options?: RunOptions | Atom.FnContext) => unknown;
	readonly runtime: unknown;
}

interface BindableRecord {
	readonly [name: string]: Bindable;
}

type Bindable = Operation | BindableRecord;

// A bound operation, or a record whose string-keyed members are bound operations or such records. Anything else, such as
// the Layer `makeClient` returns or a function beside the operations, is refused, because a call through it would silently
// act for the caller's own account.
export type SubjectBindable<TClient> = TClient extends { readonly run: (...args: never) => unknown; readonly runtime: unknown }
	? unknown
	: TClient extends (...args: never) => unknown
		? never
		: TClient extends object
			? { readonly [TKey in keyof TClient]: TKey extends string ? SubjectBindable<TClient[TKey]> : TClient[TKey] }
			: never;

// React's action hooks take `run` as the action's identity, so each operation and record is bound once per subject, and a
// record is cached before its members so one that refers back to itself binds to its own copy.
const bindings = new WeakMap<object, Map<string, Bindable>>();

function isOperation(value: object): value is Operation {
	return "runtime" in value && "run" in value && typeof value.run === "function";
}

function boundOperation(operation: Operation, subject: string): Operation {
	const { query, run } = operation;
	return {
		...operation,
		...(query === undefined ? {} : { query: (payload, options = {}) => query(payload, { ...options, subject: options.subject ?? subject }) }),
		run: (payload, options) => run(payload, { subject: runSubject(options) ?? subject }),
	};
}

function bind(value: Bindable, subject: string): Bindable {
	const bySubject = bindings.get(value) ?? new Map<string, Bindable>();
	bindings.set(value, bySubject);
	const existing = bySubject.get(subject);
	if (existing !== undefined) {
		return existing;
	}
	if (isOperation(value)) {
		const bound = boundOperation(value, subject);
		bySubject.set(subject, bound);
		return bound;
	}
	const bound: Record<string, Bindable> = { ...value };
	bySubject.set(subject, bound);
	for (const [name, member] of Object.entries(value)) {
		bound[name] = bind(member, subject);
	}
	return bound;
}

export function forSubject<TClient extends object>(client: TClient & SubjectBindable<TClient>, subject: string): TClient;
export function forSubject(client: Bindable, subject: string): Bindable {
	return bind(client, subject);
}
