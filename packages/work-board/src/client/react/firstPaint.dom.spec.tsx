import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hostedHealthScreen } from "#test/hostedHealthScreen.tsx";
import { heldWorkspace, startingBoard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, pausedDocument } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"before the workspace index answers, the shell paints its breadcrumb over a Today-shaped loading state, and Today opens once the index answers",
	[todayScreen(), heldWorkspace(), openScreen()],
	function* ({ breadcrumb, loadingPage, shownPage, workspaceAnswers }) {
		yield* outcomes([
			["breadcrumb", () => breadcrumb(), expect.stringContaining("Workspace")],
			["loading", () => loadingPage(), { message: "Loading Today", shape: "today" }],
			["page", () => shownPage(), "none"],
		]);

		yield* workspaceAnswers();

		expect(yield* shownPage()).toBe("Today");
	},
);

screenStory.it(
	"the reader can open Goals while the first page's read has not answered",
	[todayScreen(), screenRoute("/home.md"), pausedDocument("/home.md"), openScreen()],
	function* ({ loadingPage, navigateTo, shownPage }) {
		expect(yield* loadingPage()).toEqual({ message: "Loading page", shape: "document" });

		yield* navigateTo("/_board/goals");

		expect(yield* shownPage()).toBe("Goals");
	},
);

screenStory.it(
	"the live status reads Connecting… before the first live update arrives",
	[hostedHealthScreen("connecting")],
	function* ({ liveIndicator }) {
		expect(yield* liveIndicator()).toMatchObject({ announced: "Connecting…", state: "connecting" });
	},
);

screenStory.it(
	"the live status reads Connecting… while the stream is live but the source watcher has not answered, and its tooltip says why",
	[startingBoard(), hostedHealthScreen("live")],
	function* ({ liveIndicator, liveTooltip }) {
		yield* outcomes([
			["status", () => liveIndicator(), expect.objectContaining({ announced: "Connecting…" })],
			["tooltip", () => liveTooltip(), expect.stringContaining("last observed source watcher: not yet observed")],
		]);
	},
);
