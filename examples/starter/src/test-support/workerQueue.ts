import { Effect } from "effect";
import { defaultClientFactory, type PgBossClient, type PgBossClientFactory } from "@shivaedev/effect-pg-boss/client.ts";

type Complete = NonNullable<PgBossClient["complete"]>;

interface Completion {
	readonly acknowledgement: Awaited<ReturnType<Complete>>;
	readonly attempt: Parameters<Complete>[1];
	readonly queue: string;
}

export function workerQueue() {
	const completions: Completion[] = [];
	const clientFactory: PgBossClientFactory = (options) => {
		const client = defaultClientFactory(options);
		const complete = client.complete?.bind(client);
		if (complete === undefined) {
			throw new Error("The word-count client must support job completion");
		}
		const observeComplete: Complete = async (...args) => {
			const acknowledgement = await complete(...args);
			completions.push({ acknowledgement, attempt: args[1], queue: args[0] });
			return acknowledgement;
		};
		return new Proxy(client, {
			get(target, property) {
				if (property === "complete") {
					return observeComplete;
				}
				const value: unknown = Reflect.get(target, property, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	};
	return { clientFactory, completions: () => Effect.sync(() => [...completions]) };
}
