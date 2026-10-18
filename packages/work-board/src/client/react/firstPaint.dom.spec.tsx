import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { hostedHealthScreen } from "#test/hostedHealthScreen.tsx";
import { heldWorkspace, screenQuery } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"paints the shell with an opening view before the workspace index answers",
	[todayScreen(), heldWorkspace(), openScreen()],
	function* ({ findElement, readText, releaseWorkspace }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [role=status]")).toBe("Opening view…")));
		expect(readText("header")).toContain("Today");
		expect(findElement("#doc h1")).toBeNull();
		yield* Effect.promise(releaseWorkspace);
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Today")));
	},
);

screenStory.it(
	"opens the page the reader navigates to while the first page is still loading",
	[todayScreen(), screenRoute("/_board/goals"), screenQuery("goals", "pending"), openScreen()],
	function* ({ navigate, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [role=status]")).toBe("Opening view…")));
		yield* Effect.promise(() => navigate("/home.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Workspace notes")));
	},
);

screenStory.it(
	"reads connecting before the first live update instead of reporting a lost connection",
	[hostedHealthScreen("connecting")],
	function* ({ readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#live")).toBe("connecting")));
		expect(readAttribute("#live", "data-state")).toBe("connecting");
	},
);

screenStory.it(
	"reads connecting while the stream is live but the source watcher has not answered yet",
	[screenQuery("watcher", "pending"), hostedHealthScreen("live")],
	function* ({ readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#live")).toBe("connecting")));
		expect(readAttribute("#live", "title")).toContain("last observed source watcher: not yet observed");
	},
);
