import type * as AtomRef from "effect/reactivity/AtomRef";
import { propertyRef } from "#refs.ts";

type Keys<T> = T extends readonly unknown[] ? number : Extract<keyof T, string | number>;
export type FieldPath<T> = [T] extends [object]
	? { [TKey in Keys<T>]: TKey extends keyof T ? readonly [TKey] | readonly [TKey, ...FieldPath<T[TKey]>] : never }[Keys<T>]
	: never;

export type OptionalKeys<T> = { [TKey in keyof T]-?: Pick<T, TKey> extends Required<Pick<T, TKey>> ? never : TKey }[keyof T];

export type OptionalPath<T> = [T] extends [object]
	? {
			[TKey in Keys<T>]: TKey extends keyof T
				? (TKey extends OptionalKeys<T> ? readonly [TKey] : never) | readonly [TKey, ...OptionalPath<T[TKey]>]
				: never;
		}[Keys<T>]
	: never;

export type ValueAt<T, TPath> = TPath extends readonly [infer TKey extends keyof NonNullable<T>, ...infer TRest extends PropertyKey[]]
	? ValueAt<NonNullable<T>[TKey], TRest>
	: T;

export function refAt<T, const TPath extends readonly PropertyKey[] & FieldPath<T>>(
	parent: AtomRef.AtomRef<T>,
	path: TPath,
): AtomRef.AtomRef<ValueAt<T, TPath>>;
export function refAt(parent: AtomRef.AtomRef<unknown>, path: readonly PropertyKey[]): AtomRef.AtomRef<unknown> {
	let ref = parent;
	for (const segment of path) {
		ref = propertyRef(ref, segment);
	}
	return ref;
}

export function omitAt<T>(parent: AtomRef.AtomRef<T>, path: readonly [PropertyKey, ...PropertyKey[]]): void;
export function omitAt(parent: AtomRef.AtomRef<unknown>, path: readonly [PropertyKey, ...PropertyKey[]]): void {
	let ref = parent;
	let name = path[0];
	for (const segment of path.slice(1)) {
		ref = propertyRef(ref, name);
		name = segment;
	}
	ref.update((current) => {
		const next = {};
		Object.assign(next, current);
		Reflect.deleteProperty(next, name);
		return next;
	});
}
