import { expect } from "vitest";
import { baselineWorkspace, recorded } from "#baseline-workspace";
import { CLI_EXIT, CLI_TIMEOUT } from "#test/cli.ts";

baselineWorkspace.it(
	"branches removing neighbouring entries merge without conflict through the configured driver",
	[recorded],
	function* (repo) {
		const before = yield* repo.git("config", "--local", "--list");
		expect((yield* repo.cli("baseline", "install-driver")).status).toBe(CLI_EXIT.passed);
		const after = yield* repo.git("config", "--local", "--list");
		expect(after.split("\n").filter((line) => !line.startsWith("merge.quality-baseline.driver="))).toEqual(before.split("\n"));
		yield* repo.git("switch", "-c", "left");
		yield* repo.repair("packages/alpha/src/a.ts");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.checkpoint("Remove first debt");
		yield* repo.git("switch", "-c", "right", "main");
		yield* repo.repair("packages/alpha/src/b.ts");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.checkpoint("Remove adjacent debt");
		yield* repo.git("merge", "--no-edit", "left");
		expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toBe(
			'{"path":"packages/alpha/src/c.ts","rule":"structure/max-lines","count":3}\n',
		);
		expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.passed);
	},
	CLI_TIMEOUT,
);

baselineWorkspace.it(
	"removing an entry wins over lowering its count on the other branch",
	[recorded],
	function* (repo) {
		expect((yield* repo.cli("baseline", "install-driver")).status).toBe(CLI_EXIT.passed);
		yield* repo.git("switch", "-c", "lower");
		yield* repo.repair("packages/alpha/src/a.ts", 4);
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.git("restore", "packages/alpha/src/a.ts");
		yield* repo.checkpoint("Lower debt");
		yield* repo.git("switch", "-c", "remove", "main");
		yield* repo.repair("packages/alpha/src/a.ts");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.git("restore", "packages/alpha/src/a.ts");
		yield* repo.checkpoint("Remove debt");
		yield* repo.git("merge", "--no-edit", "lower");
		const merged = yield* repo.read("packages/alpha/quality-baseline.jsonl");
		expect(merged).not.toContain('"path":"packages/alpha/src/a.ts"');
		expect(merged).toContain('"path":"packages/alpha/src/b.ts"');
	},
	CLI_TIMEOUT,
);

baselineWorkspace.it(
	"concurrent count reductions take the minimum and new entries from both branches survive",
	[recorded],
	function* (repo) {
		expect((yield* repo.cli("baseline", "install-driver")).status).toBe(CLI_EXIT.passed);
		const original = yield* repo.read("packages/alpha/quality-baseline.jsonl");
		if (original === undefined) {
			throw new Error("No package baseline was recorded");
		}
		yield* repo.git("switch", "-c", "left");
		yield* repo.write(
			"packages/alpha/quality-baseline.jsonl",
			`${original.replace('"count":3', '"count":1')}{"path":"packages/alpha/src/d.ts","rule":"structure/max-lines","count":2}\n`,
		);
		yield* repo.checkpoint("Lower count and add debt");
		yield* repo.git("switch", "-c", "right", "main");
		yield* repo.write(
			"packages/alpha/quality-baseline.jsonl",
			`${original.replace('"count":3', '"count":2')}{"path":"packages/alpha/src/e.ts","rule":"structure/max-lines","count":4}\n`,
		);
		yield* repo.checkpoint("Lower count and add other debt");
		yield* repo.git("merge", "--no-edit", "left");
		const merged = yield* repo.read("packages/alpha/quality-baseline.jsonl");
		expect(merged).toContain('{"path":"packages/alpha/src/a.ts","rule":"structure/max-lines","count":1}');
		expect(merged).toContain('{"path":"packages/alpha/src/d.ts","rule":"structure/max-lines","count":2}');
		expect(merged).toContain('{"path":"packages/alpha/src/e.ts","rule":"structure/max-lines","count":4}');
	},
	CLI_TIMEOUT,
);

baselineWorkspace.it(
	"tighten removes the empty shard left when branches remove all entries between them",
	[recorded],
	function* (repo) {
		expect((yield* repo.cli("baseline", "install-driver")).status).toBe(CLI_EXIT.passed);
		yield* repo.git("switch", "-c", "left");
		yield* repo.repair("packages/alpha/src/a.ts");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.checkpoint("Remove first entry");
		yield* repo.git("switch", "-c", "right", "main");
		yield* repo.repair("packages/alpha/src/b.ts");
		yield* repo.repair("packages/alpha/src/c.ts");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		yield* repo.checkpoint("Remove other entries");
		yield* repo.git("merge", "--no-edit", "left");
		expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toBe("");
		expect((yield* repo.cli("baseline", "tighten")).status).toBe(CLI_EXIT.passed);
		expect(yield* repo.read("packages/alpha/quality-baseline.jsonl")).toBeUndefined();
		expect((yield* repo.cli("lint")).status).toBe(CLI_EXIT.passed);
	},
	CLI_TIMEOUT,
);
