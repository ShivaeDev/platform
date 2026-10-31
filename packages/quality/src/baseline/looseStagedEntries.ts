import { Effect } from "effect";
import { validOrFail } from "#decoded.ts";
import type { Session } from "#engine/session.ts";
import { keyOf } from "#engine/violation.ts";
import { applyRegistry } from "#exceptions/registry.ts";
import { gitOrFail, run } from "#git/command.ts";
import { changesSince } from "#git/history.ts";
import { applyBaseline } from "./compare.ts";
import { type BaselineEntry, decodeBaseline } from "./format.ts";
import { shardOf } from "./shards.ts";

export const looseStagedEntries = Effect.fn("Baseline.looseStagedEntries")(function* (session: Session) {
	const { root, baseline } = session.config;
	const changed = yield* changesSince(root, ["--cached"]);
	const shards = new Set([...changed.files].map((file) => shardOf(file, baseline)));
	const paths = (yield* gitOrFail(root, ["ls-files", "-z", "--", baseline, "packages/*/quality-baseline.jsonl"]))
		.split("\0")
		.filter((path) => shards.has(path));
	const head = yield* run(root, ["rev-parse", "--verify", "--quiet", "HEAD"]);
	const entries: BaselineEntry[] = [];
	for (const path of paths) {
		const raw = yield* gitOrFail(root, ["show", `:./${path}`]);
		const decoded = yield* validOrFail(path, yield* Effect.promise(() => decodeBaseline(raw)));
		const tracked = head.code === 0 ? yield* gitOrFail(root, ["ls-tree", "HEAD", "--", path]) : "";
		const previous = tracked === "" ? undefined : yield* gitOrFail(root, ["show", `HEAD:./${path}`]);
		const before = yield* validOrFail(path, yield* Effect.promise(() => decodeBaseline(previous)));
		const counts = new Map(before.map((entry) => [keyOf(entry.rule, entry.file), entry.count]));
		entries.push(...decoded.filter((entry) => changed.files.has(entry.file) || counts.get(keyOf(entry.rule, entry.file)) !== entry.count));
	}
	const violations = applyRegistry(session.violations, session.registry, session.config).kept;
	return applyBaseline(violations, entries, session.config).loose;
});
