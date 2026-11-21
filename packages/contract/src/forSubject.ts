import type * as Atom from "effect/reactivity/Atom";
import type { QueryOptions, RunOptions } from "#Bound.ts";
import { runSubject } from "#clientOperations.ts";

interface Operation {
	readonly query?: (payload: unknown, options?: QueryOptions) => unknown;
	readonly run: (payload: unknown, options?: RunOptions | Atom.FnContext) => unknown;
}

// React's action hooks take `run` as the action's identity, so each operation and record is bound once per subject.
const bindings = new WeakMap<object, Map<string, object>>();

function isOperation(value: object): value is Operation {
	return "runtime" in value && "run" in value && typeof value.run === "function";
}

function isRecord(value: object): value is Readonly<Record<string, unknown>> {
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function boundOperation(operation: Operation, subject: string): Operation {
	const { query, run } = operation;
	return {
		...operation,
		...(query === undefined ? {} : { query: (payload, options = {}) => query(payload, { ...options, subject: options.subject ?? subject }) }),
		run: (payload, options) => run(payload, { subject: runSubject(options) ?? subject }),
	};
}

function bind(value: unknown, subject: string): unknown {
	if (typeof value !== "object" || value === null || !(isOperation(value) || isRecord(value))) {
		return value;
	}
	const bySubject = bindings.get(value) ?? new Map<string, object>();
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
	// A record is cached before its members are bound, so a record that refers back to itself binds to its own copy.
	const bound: Record<string, unknown> = { ...value };
	bySubject.set(subject, bound);
	for (const [name, member] of Object.entries(value)) {
		bound[name] = bind(member, subject);
	}
	return bound;
}

export function forSubject<TClient extends object>(client: TClient, subject: string): TClient;
export function forSubject(client: object, subject: string): unknown {
	return bind(client, subject);
}
