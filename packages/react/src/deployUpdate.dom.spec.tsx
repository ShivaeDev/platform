import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deployStory } from "#test/deploy-update/story.tsx";

deployStory.it(
	"a loaded tab hears the replacement host on its existing live connection and offers reload",
	[],
	function* ({ openTab, restart, waitForVersion, status, shown, sockets, activations, reload, reloads }) {
		yield* openTab("build-a");
		yield* outcomes([
			["deploy status", () => status(), { available: "false", blocked: "false", version: "build-a" }],
			["shared sockets", () => sockets(), ["/rpc"]],
			["application", () => shown(), expect.stringContaining("Application ready")],
		]);
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* outcomes([
			["deploy status", () => status(), { available: "true", blocked: "false", version: "build-b" }],
			["activations", () => activations(), []],
		]);
		yield* reload();
		expect(yield* reloads()).toEqual(["reload requested"]);
	},
);

deployStory.it(
	"a hidden tab activates the staged update after learning the replacement build",
	[],
	function* ({ openTab, hide, restart, waitForVersion, status, activations }) {
		yield* openTab("build-a");
		yield* hide();
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* outcomes([
			["activations", () => activations(), ["staged update"]],
			["deploy status", () => status(), expect.objectContaining({ available: "false" })],
		]);
	},
);

deployStory.it(
	"a hidden tab waits for both a pending write and an open sheet",
	[],
	function* ({ openTab, holdWrite, finishWrite, openSheet, hide, restart, waitForVersion, closeSheet, activations, status }) {
		yield* openTab("build-a");
		yield* holdWrite();
		yield* openSheet();
		yield* hide();
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* outcomes([
			["activations", () => activations(), []],
			["deploy status", () => status(), expect.objectContaining({ available: "true", blocked: "true" })],
		]);
		yield* finishWrite();
		expect(yield* activations()).toEqual([]);
		yield* closeSheet();
		yield* outcomes([
			["activations", () => activations(), ["staged update"]],
			["deploy status", () => status(), expect.objectContaining({ available: "false", blocked: "false" })],
		]);
	},
);

deployStory.it("hiding a tab with an already staged update activates it", [], function* ({ openTab, restart, waitForVersion, hide, activations }) {
	yield* openTab("build-a");
	yield* restart("build-b");
	yield* waitForVersion("build-b");
	expect(yield* activations()).toEqual([]);
	yield* hide();
	expect(yield* activations()).toEqual(["staged update"]);
});

deployStory.it("the loaded build leaves the hidden tab alone", [], function* ({ openTab, hide, status, activations }) {
	yield* openTab("build-a");
	yield* hide();
	yield* outcomes([
		["deploy status", () => status(), expect.objectContaining({ available: "false" })],
		["activations", () => activations(), []],
	]);
});

deployStory.it(
	"failed activation keeps reload available",
	[],
	function* ({ openTab, failActivation, hide, restart, waitForVersion, status, reload, reloads, activation }) {
		yield* openTab("build-a");
		yield* failActivation();
		yield* hide();
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* outcomes([
			["deploy status", () => status(), expect.objectContaining({ available: "true" })],
			["activation failure", () => activation(), "Staged update failed"],
		]);
		yield* reload();
		expect(yield* reloads()).toEqual(["reload requested"]);
	},
);

deployStory.it(
	"a staged version activates only once across visibility changes",
	[],
	function* ({ openTab, restart, waitForVersion, hide, show, activations }) {
		yield* openTab("build-a");
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* hide();
		yield* show();
		yield* hide();
		expect(yield* activations()).toEqual(["staged update"]);
	},
);

deployStory.it("a host without a build ID serves the application without offering a deploy", [], function* ({ restart, openTab, status, shown }) {
	yield* restart(undefined);
	yield* openTab("build-a");
	yield* outcomes([
		["application", () => shown(), expect.stringContaining("Application ready")],
		["deploy status", () => status(), { available: "false", blocked: "false", version: "Waiting for host" }],
	]);
});

deployStory.it(
	"a tab without staged activation keeps reload available while hidden",
	[],
	function* ({ reloadOnly, openTab, restart, waitForVersion, hide, status, activations }) {
		yield* reloadOnly();
		yield* openTab("build-a");
		yield* restart("build-b");
		yield* waitForVersion("build-b");
		yield* hide();
		yield* outcomes([
			["deploy status", () => status(), expect.objectContaining({ available: "true" })],
			["activations", () => activations(), []],
		]);
	},
);
