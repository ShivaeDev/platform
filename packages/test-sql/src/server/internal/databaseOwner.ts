import { createHash } from "node:crypto";
import { hostname } from "node:os";
import process from "node:process";

const host = createHash("sha256").update(hostname()).digest("hex").slice(0, 8);

export function databaseName() {
	return `effect_test_${host}_${process.pid}_${crypto.randomUUID().replaceAll("-", "")}`;
}

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
