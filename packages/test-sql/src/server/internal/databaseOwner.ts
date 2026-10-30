import { createHash } from "node:crypto";
import { hostname } from "node:os";
import process from "node:process";
import { Effect, Random } from "effect";

const host = createHash("sha256").update(hostname()).digest("hex").slice(0, 8);

export const databaseId = Effect.map(Effect.replicateEffect(Random.nextIntBetween(0, 0xff_ff_ff_ff), 4), (parts) =>
	parts.map((part) => part.toString(16).padStart(8, "0")).join(""),
);

export const databaseName = Effect.map(databaseId, (id) => `effect_test_${host}_${process.pid}_${id}`);

export function abandonedDatabase(name: string) {
	if (/^effect_test_[a-f0-9]{32}$/u.test(name)) {
		return true;
	}
	const owner = /^effect_test_(?<host>[a-f0-9]{8})_(?<pid>[0-9]+)_[a-f0-9]{32}$/u.exec(name);
	if (owner === null || owner.groups?.host !== host) {
		return false;
	}
	try {
		process.kill(Number(owner.groups.pid), 0);
		return false;
	} catch (error) {
		return error instanceof Error && "code" in error && error.code === "ESRCH";
	}
}
