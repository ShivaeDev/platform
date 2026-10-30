import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { promiseRunning } from "#test/promiseRunning.ts";
import { biomeRunning, brokenConfig, crashingRule, qualityLifecycle } from "#test/qualityLifecycle.ts";

qualityLifecycle.it(
	"interrupting Biome exits 130, stops its child and removes its temporary config",
	[biomeRunning],
	function* ({ childRunning, interrupt, originalEntries, rootEntries, status, stderr, temporaryConfigExists }) {
		expect(yield* childRunning()).toBe(true);
		expect(yield* temporaryConfigExists()).toBe(true);
		const before = originalEntries();

		yield* interrupt();

		yield* outcomes({
			"Biome child running": [childRunning(), false],
			"error output": [Effect.sync(stderr), ""],
			"exit status": [Effect.sync(status), 130],
			"repository entries": [rootEntries(), before],
			"temporary config exists": [temporaryConfigExists(), false],
		});
	},
);

qualityLifecycle.it("a crashing rule exits 2 and prints its id and original stack", [crashingRule], function* ({ check, status, stderr }) {
	yield* check();

	yield* outcomes({
		"defect output": [Effect.sync(stderr), expect.stringContaining("quality: internal error")],
		"exit status": [Effect.sync(status), 2],
		"original stack": [Effect.sync(stderr), expect.stringMatching(/at .*crashRule.*quality\.config\.ts:\d+:\d+/u)],
		"rule and error": [Effect.sync(stderr), expect.stringContaining("rule local/crash failed: policy crashed")],
	});
});

qualityLifecycle.it(
	"a setup failure retains its original cause without enumerating or serializing it",
	[brokenConfig],
	function* ({ check, setupFailure }) {
		yield* check();

		expect(setupFailure()).toMatchObject({ cause: "config crashed", enumerableCause: false });
		expect(setupFailure().serialized).not.toContain('"cause"');
	},
);

qualityLifecycle.it("interrupting a Promise check aborts its signal", [promiseRunning], function* ({ interrupt, promiseAborted }) {
	expect(yield* promiseAborted()).toBe(false);

	yield* interrupt();

	expect(yield* promiseAborted()).toBe(true);
});
