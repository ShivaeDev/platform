import assert from "node:assert/strict";
import { test as it } from "node:test";
import { measuredMain } from "#ci/test-support/measuredMain.ts";
import { mainShardPlan } from "./mainShardPlan.ts";

it("pins independent main counts and snapshots, skipping invalid provenance", () => {
	assert.deepEqual(mainShardPlan("owner/repo", false, measuredMain), {
		consumers: { artifactId: "4300", count: 5, runId: "43" },
		tests: { artifactId: "4200", count: 3, runId: "42" },
	});
});

it("main measures in one job per family and PRs fall back independently without access", () => {
	assert.deepEqual(
		mainShardPlan("owner/repo", true, () => {
			throw new Error("must not fetch");
		}),
		{ consumers: { artifactId: "", count: 1, runId: "" }, tests: { artifactId: "", count: 1, runId: "" } },
	);
	assert.deepEqual(
		mainShardPlan("owner/repo", false, () => {
			throw new Error("denied");
		}),
		{ consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "", count: 8, runId: "" } },
	);
});

it("a missing consumer snapshot does not discard the independent test plan", () => {
	const plan = mainShardPlan("owner/repo", false, (args) =>
		args[0] === "api" && args[1]?.includes("name=consumer-balancing") ? JSON.stringify({ artifacts: [] }) : measuredMain(args),
	);
	assert.deepEqual(plan, { consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "4200", count: 3, runId: "42" } });
});

it("rejects an artifact replaced while selecting its count", () => {
	let identity = 0;
	const plan = mainShardPlan("owner/repo", false, (args) => {
		if (args[0] === "api" && args[1]?.includes("/artifacts?")) {
			identity += 1;
			return JSON.stringify({ artifacts: [{ expired: false, id: identity, name: args[1].split("name=")[1] }] });
		}
		return measuredMain(args);
	});
	assert.equal(plan.tests.runId, "");
	assert.equal(plan.consumers.runId, "");
});
