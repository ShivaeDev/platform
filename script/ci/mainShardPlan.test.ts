import assert from "node:assert/strict";
import { test as it } from "node:test";
import { measuredMain } from "#ci/test-support/measuredMain.ts";
import { mainShardPlan } from "./mainShardPlan.ts";

it("pins independent main counts and snapshots, skipping invalid provenance and keeping at least four test shards", () => {
	assert.deepEqual(mainShardPlan("owner/repo", undefined, measuredMain), {
		consumers: { artifactId: "4300", count: 5, runId: "43" },
		tests: { artifactId: "4200", count: 4, runId: "42" },
	});
});

it("main shards consumers like a PR while main already caches the consumer store for these manifests", () => {
	assert.deepEqual(mainShardPlan("owner/repo", "consumer-store-cached", measuredMain), {
		consumers: { artifactId: "4300", count: 5, runId: "43" },
		tests: { artifactId: "4200", count: 4, runId: "42" },
	});
});

it("main checks every consumer in one job when it must save a complete store for new manifests", () => {
	for (const key of ["consumer-store-new", "consumer-store-cached-old"]) {
		assert.deepEqual(mainShardPlan("owner/repo", key, measuredMain).consumers, { artifactId: "4300", count: 1, runId: "43" });
	}
	const cacheDenied = mainShardPlan("owner/repo", "consumer-store-cached", (args) => {
		if (args[1]?.includes("actions/caches?")) {
			throw new Error("denied");
		}
		return measuredMain(args);
	});
	assert.equal(cacheDenied.consumers.count, 1);
});

function denied(): string {
	throw new Error("denied");
}

it("main and PRs fall back independently without access", () => {
	assert.deepEqual(mainShardPlan("owner/repo", "consumer-store-cached", denied), {
		consumers: { artifactId: "", count: 1, runId: "" },
		tests: { artifactId: "", count: 8, runId: "" },
	});
	assert.deepEqual(mainShardPlan("owner/repo", undefined, denied), {
		consumers: { artifactId: "", count: 8, runId: "" },
		tests: { artifactId: "", count: 8, runId: "" },
	});
});

it("a missing consumer snapshot does not discard the independent test plan", () => {
	const plan = mainShardPlan("owner/repo", undefined, (args) =>
		args[0] === "api" && args[1]?.includes("name=consumer-balancing") ? JSON.stringify({ artifacts: [] }) : measuredMain(args),
	);
	assert.deepEqual(plan, { consumers: { artifactId: "", count: 8, runId: "" }, tests: { artifactId: "4200", count: 4, runId: "42" } });
});

it("rejects an artifact replaced while selecting its count", () => {
	let identity = 0;
	const plan = mainShardPlan("owner/repo", undefined, (args) => {
		if (args[0] === "api" && args[1]?.includes("/artifacts?")) {
			identity += 1;
			return JSON.stringify({ artifacts: [{ expired: false, id: identity, name: args[1].split("name=")[1] }] });
		}
		return measuredMain(args);
	});
	assert.equal(plan.tests.runId, "");
	assert.equal(plan.consumers.runId, "");
});
