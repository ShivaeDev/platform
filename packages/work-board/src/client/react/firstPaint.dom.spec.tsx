import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { hostedHealthScreen } from "#test/hostedHealthScreen.tsx";
import { heldWorkspace, startingBoard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, pausedDocument } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"paints the shell with a Today-shaped skeleton before the workspace index answers",
	[todayScreen(), heldWorkspace(), openScreen()],
	function* ({ findElement, readText, releaseWorkspace }) {
		yield* eventually(() => expect(readText("#doc [role=status]")).toBe("Loading Today"));
		expect(findElement('#doc [data-loading-shape="rows"] [data-slot="skeleton"]')).not.toBeNull();
		expect(readText("#doc")).not.toMatch(/Opening|…/u);
		expect(readText("header")).toContain("Today");
		expect(findElement("#doc h1")).toBeNull();
		yield* Effect.promise(releaseWorkspace);
		yield* eventually(() => expect(readText("#doc h1")).toBe("Today"));
	},
);

screenStory.it(
	"opens the page the reader navigates to while the first page is still loading",
	[todayScreen(), screenRoute("/home.md"), pausedDocument("/home.md"), openScreen()],
	function* ({ navigate, readText }) {
		yield* eventually(() => expect(readText("#doc [role=status]")).toBe("Loading page"));
		yield* Effect.promise(() => navigate("/_board/goals"));
		yield* eventually(() => expect(readText("#doc h1")).toBe("Goals"));
	},
);

screenStory.it(
	"reads connecting before the first live update instead of reporting a lost connection",
	[hostedHealthScreen("connecting")],
	function* ({ readAttribute, readText }) {
		yield* eventually(() => expect(readText("#live")).toBe("Connecting…"));
		expect(readAttribute("#live", "data-state")).toBe("connecting");
	},
);

screenStory.it(
	"reads connecting while the stream is live but the source watcher has not answered yet",
	[startingBoard(), hostedHealthScreen("live")],
	function* ({ readAttribute, readText }) {
		yield* eventually(() => expect(readText("#live")).toBe("Connecting…"));
		expect(readAttribute("#live", "title")).toContain("last observed source watcher: not yet observed");
	},
);
