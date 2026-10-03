import { countOperations, delegateOf, rowOperations } from "./model.ts";
import type { LooseMap, Write } from "./write.ts";

export const isWriteOperation = (operation: string): boolean => rowOperations.has(operation) || countOperations.has(operation);

export const delegatesOf = <A>(models: LooseMap<A>): ReadonlyMap<string, string> =>
	new Map(
		Object.entries(models).flatMap(([model, changesOf]) =>
			changesOf === undefined || changesOf === null ? [] : [[delegateOf(model), model] as const],
		),
	);

const bound = (value: unknown, target: object): unknown => (typeof value === "function" ? value.bind(target) : value);

const recordingDelegate = (delegate: object, model: string, collect: (write: Write) => void): object =>
	new Proxy(delegate, {
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

export const recordingClient = <Client extends object>(
	client: Client,
	delegates: ReadonlyMap<string, string>,
	collect: (write: Write) => void,
): Client =>
	new Proxy(client, {
		get: (target, key) => {
			const value: unknown = Reflect.get(target, key);
			const model = typeof key === "string" ? delegates.get(key) : undefined;
			if (model !== undefined && typeof value === "object" && value !== null) {
				return recordingDelegate(value, model, collect);
			}
			return bound(value, target);
		},
	});
