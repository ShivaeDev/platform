import { expect } from "vitest";
import { isolatedStorage } from "#test/storageStory.ts";

const WAITS = [
	{ stage: "needs-human", workId: "question" },
	{ blocker: "execution capacity is occupied (limit 1)", stage: "prepared", workId: "blocked" },
	{ blocker: "waiting for area fleet/host held by one", stage: "prepared", workId: "area" },
	{ blocker: "Fresh available provider quota is required", stage: "prepared", workId: "quota" },
	{ decision: { published: { request: "original" } }, stage: "needs-human", workId: "published" },
	{ decision: { reason: "Reviewed PR is ready to merge" }, stage: "needs-human", workId: "ready" },
	{ checks: { pending: true }, stage: "validating", workId: "checks" },
	{ attentionOwner: "maintainer", stage: "needs-human", workId: "assigned" },
	{ stage: "executing", workId: "active" },
	{ launchRetry: { rejectedAt: 100, rejections: 1, retryAt: 30_100 }, stage: "prepared", workId: "retry" },
];
const OWNERS = [
	{ decisionOwner: null, owner: null, version: 1, workId: "active" },
	{ decisionOwner: null, owner: "automation", version: 2, workId: "area" },
	{ decisionOwner: null, owner: "maintainer", version: 1, workId: "assigned" },
	{ decisionOwner: null, owner: "automation", version: 2, workId: "blocked" },
	{ decisionOwner: null, owner: "automation", version: 2, workId: "checks" },
	{ decisionOwner: "maintainer", owner: "maintainer", version: 2, workId: "published" },
	{ decisionOwner: null, owner: "orchestrator", version: 2, workId: "question" },
	{ decisionOwner: null, owner: "automation", version: 2, workId: "quota" },
	{ decisionOwner: "maintainer", owner: "maintainer", version: 2, workId: "ready" },
	{ decisionOwner: null, owner: "automation", version: 2, workId: "retry" },
];

isolatedStorage.it(
	"the attention owner migration gives each existing wait its owner and leaves assigned owners and active records as they were",
	[],
	function* ({ insertPayloads, migrate, namespace, owners, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* insertPayloads(namespace, WAITS, () => 1);

		yield* migrate(namespace, "attention_owner");

		expect(yield* owners(namespace)).toEqual(OWNERS);
	},
);

isolatedStorage.it(
	"rerunning the attention owner migration changes no owner or version",
	[],
	function* ({ insertPayloads, migrate, namespace, owners, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* insertPayloads(namespace, WAITS, () => 1);
		yield* migrate(namespace, "attention_owner");

		yield* migrate(namespace, "attention_owner");

		expect(yield* owners(namespace)).toEqual(OWNERS);
	},
);
