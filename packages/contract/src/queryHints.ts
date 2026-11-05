import { invalidationKeys, type Key, readKeys } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "#live.ts";
import type { SubscriptionHint } from "#queryUpdate.ts";

export function localQueryKeys(keys: readonly Key[]) {
	return keys.filter((key) => key.collection.startsWith("@query/"));
}

export function queryHint(hint: SubscriptionHint, tracked: readonly { readonly keys: readonly Key[] }[]): SubscriptionHint {
	if (hint._tag !== "Changed") {
		return hint;
	}
	const invalidated = invalidationKeys(hint.keys);
	return {
		_tag: "Changed",
		keys: [
			...hint.keys,
			...tracked.flatMap(({ keys }, index) => {
				const local = keys.filter((key) => !key.collection.startsWith("@query/"));
				const affected =
					hint.queryIndexes === undefined
						? local.length === 0 || hint.keys.some((key) => key._tag === "Bucket") || readKeys(local).some((key) => invalidated.includes(key))
						: hint.queryIndexes.includes(index);
				return affected ? localQueryKeys(keys) : [];
			}),
		],
	};
}

export function changedHint(keys: readonly Key[], scopes?: readonly (readonly Key[])[]): LiveHint {
	const changed = new Set(keys.map((key) => JSON.stringify(key)));
	return {
		_tag: "Changed",
		keys,
		...(scopes === undefined
			? {}
			: { queryIndexes: scopes.flatMap((scope, index) => (scope.some((key) => changed.has(JSON.stringify(key))) ? [index] : [])) }),
	};
}
