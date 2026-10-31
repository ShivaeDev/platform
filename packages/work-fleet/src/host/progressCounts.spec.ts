import { expect } from "vitest";
import { HEAD, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const pullRequest = { head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR };
host.it(
	"Board progress matches Fleet working and PR waiting buckets and excludes queued, done and no-PR waits",
	[
		storedWork("working", "working"),
		storedWork("reviewing", "reviewing"),
		...(["automation", "maintainer", "orchestrator"] as const).map((attentionOwner) =>
			storedWork(attentionOwner, "waiting", { attentionOwner, blocker: "Waiting for confirmation", result: pullRequest }),
		),
		storedWork("no-change", "waiting", { attentionOwner: "orchestrator", blocker: "Confirm no change" }),
		storedWork("queued", "queued"),
		storedWork("done", "done"),
	],
	function* (work) {
		const status = yield* work.status();
		const fleetProgress = [
			...status.active.filter((item) => item.stage === "working" || item.stage === "reviewing"),
			...Object.values(status.waiting)
				.flat()
				.filter((item) => item.links.includes(PR)),
		]
			.map((item) => item.workId)
			.sort((left, right) => left.localeCompare(right));

		const boardProgress = yield* work.boardProgress();

		expect(boardProgress?.toSorted((left, right) => left.localeCompare(right))).toEqual([
			"automation",
			"maintainer",
			"orchestrator",
			"reviewing",
			"working",
		]);
		expect(boardProgress?.toSorted((left, right) => left.localeCompare(right))).toEqual(fleetProgress);
	},
);
