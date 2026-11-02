import { Effect, Random } from "effect";
import { processIsAbsent, processOwner } from "#adapters/processOwner.ts";

export const databaseId = Effect.map(Effect.replicateEffect(Random.nextIntBetween(0, 0xff_ff_ff_ff), 4), (parts) =>
	parts.map((part) => part.toString(16).padStart(8, "0")).join(""),
);

export const databaseName = Effect.gen(function* () {
	const { host, pid } = yield* processOwner;
	return `effect_test_${host}_${pid}_${yield* databaseId}`;
});

export const abandonedDatabase = Effect.fnUntraced(function* (name: string) {
	if (/^effect_test_[a-f0-9]{32}$/u.test(name)) {
		return true;
	}
	const owner = /^effect_test_(?<host>[a-f0-9]{8})_(?<pid>[0-9]+)_[a-f0-9]{32}$/u.exec(name);
	if (owner === null || owner.groups?.host !== (yield* processOwner).host) {
		return false;
	}
	return yield* processIsAbsent(Number(owner.groups.pid));
});
