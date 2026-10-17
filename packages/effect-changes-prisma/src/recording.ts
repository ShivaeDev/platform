import { countOperations, delegateOf, rowOperations } from "./model.ts";
import type { LooseMap, Write } from "./write.ts";

export function isWriteOperation(operation: string): boolean {
	return rowOperations.has(operation) || countOperations.has(operation);
}

export function delegatesOf<A>(models: LooseMap<A>): ReadonlyMap<string, string> {
	return new Map(
		Object.entries(models).flatMap(([model, changesOf]) =>
			changesOf === undefined || changesOf === null ? [] : [[delegateOf(model), model] as const],
		),
	);
}

function bound(value: unknown, target: object): unknown {
	return typeof value === "function" ? value.bind(target) : value;
}

function recordingDelegate(delegate: object, model: string, collect: (write: Write) => void): object {
	return new Proxy(delegate, {
		get: (target, key) => {
			const value: unknown = Reflect.get(target, key);
			if (typeof key !== "string" || typeof value !== "function" || !isWriteOperation(key)) {
				return bound(value, target);
			}
			return (...args: readonly unknown[]) =>
				Promise.resolve(Reflect.apply(value, target, args)).then((result: unknown) => {
					collect({ model, operation: key, result });
					return result;
				});
		},
	});
}

export function recordingClient<TClient extends object>(
	client: TClient,
	delegates: ReadonlyMap<string, string>,
	collect: (write: Write) => void,
): TClient {
	return new Proxy(client, {
		get: (target, key) => {
			const value: unknown = Reflect.get(target, key);
			const model = typeof key === "string" ? delegates.get(key) : undefined;
			if (model !== undefined && typeof value === "object" && value !== null) {
				return recordingDelegate(value, model, collect);
			}
			return bound(value, target);
		},
	});
}
