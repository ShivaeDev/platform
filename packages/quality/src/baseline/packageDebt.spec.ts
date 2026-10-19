import { expect } from "vitest";
import { baselineWorkspace, recorded } from "#baseline-workspace";
import { CLI_EXIT } from "#test/cli.ts";

baselineWorkspace.it("tighten lowers changed files in their own shards and leaves other shards byte for byte", [recorded], function* (repo) {
	const alpha = yield* repo.read("packages/alpha/quality-baseline.jsonl");
	const beta = yield* repo.read("packages/beta/quality-baseline.jsonl");
	const root = yield* repo.read("quality-baseline.jsonl");
	expect(alpha).toContain('"path":"packages/alpha/src/a.ts"');
	expect(beta).toContain('"path":"packages/beta/src/b.ts"');
	expect(root).toContain('"path":"src/root.ts"');
	expect(yield* repo.read("packages/clean/quality-baseline.jsonl")).toBeUndefined();
	yield* repo.repair("packages/alpha/src/a.ts");
	expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
	expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toBe(
		alpha
			?.split("\n")
			.filter((line) => !line.includes("packages/alpha/src/a.ts"))
			.join("\n"),
	);
	expect(yield* repo.read("packages/beta/quality-baseline.jsonl")).toBe(beta);
	expect(yield* repo.read("quality-baseline.jsonl")).toBe(root);
	expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.passed);
});

baselineWorkspace.it("prune removes an empty package shard and retains debt in other shards", [recorded], function* (repo) {
	yield* repo.repair("packages/beta/src/b.ts");
	expect((yield* repo.cli("baseline", "prune")).status).toBe(CLI_EXIT.passed);
	expect(yield* repo.read("packages/beta/quality-baseline.jsonl")).toBeUndefined();
	expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toContain('"path":"packages/alpha/src/a.ts"');
	expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.passed);
	yield* repo.repair("packages/alpha/src/a.ts", 7);
	expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.rejected);
});

baselineWorkspace.it("a tracked move carries debt to the destination package shard", [recorded], function* (repo) {
	yield* repo.git("mv", "packages/beta/src/b.ts", "packages/clean/src/b.ts");
	expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
	expect(yield* repo.read("packages/beta/quality-baseline.jsonl")).toBeUndefined();
	expect(yield* repo.read("packages/clean/quality-baseline.jsonl")).toContain('"path":"packages/clean/src/b.ts"');
	expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.passed);
});

baselineWorkspace.it("migrating a single JSON Lines baseline splits paths without changing counts", [], function* (repo) {
	const outside = '{"path":"src/root.ts","rule":"structure/max-lines","count":3}\n';
	const inside = '{"path":"packages/alpha/src/a.ts","rule":"structure/max-lines","count":2}\n';
	yield* repo.write("quality/baseline.jsonl", `${outside}${inside}`);
	expect((yield* repo.cli("baseline", "migrate", "--from", "quality/baseline.jsonl")).status).toBe(CLI_EXIT.passed);
	expect(yield* repo.read("quality/baseline.jsonl")).toBeUndefined();
	expect(yield* repo.read("quality-baseline.jsonl")).toBe(outside);
	expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toBe(inside);
	expect(yield* repo.read("packages/beta/quality-baseline.jsonl")).toBeUndefined();
});

baselineWorkspace.it("lint rejects debt recorded outside its path's shard", [], function* (repo) {
	yield* repo.write("quality-baseline.jsonl", '{"path":"packages/alpha/src/a.ts","rule":"structure/max-lines","count":3}\n');
	const result = yield* repo.cli("lint");
	expect(result.status).toBe(CLI_EXIT.invalid);
	expect(result.stderr).toContain("packages/alpha/src/a.ts belongs in packages/alpha/quality-baseline.jsonl");
});
