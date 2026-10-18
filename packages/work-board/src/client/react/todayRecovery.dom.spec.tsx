import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"retries Today's unavailable workspace and tracks pending and recovered health",
	[todayScreen(), unavailableWorkspace(), openScreen()],
	function* ({ readText, readAttribute, findElements, recoverWorkspace, click, holdWorkspace, releaseWorkspace, refreshToday }) {
		yield* Effect.promise(() => eventually(() => expect(readText('[aria-label="Page health"]')).toBe("failed")));
		expect(readAttribute("#doc", "data-status")).toBe("503");
		recoverWorkspace();
		click("#home-open");
		yield* Effect.promise(() => eventually(() => expect(readText('[aria-label="Page health"]')).toBe("settled")));
		expect(readText("#doc h1")).toBe("Today");
		expect(readAttribute("#doc", "data-status")).toBe("200");
		expect(findElements("[data-attention-id]")).toHaveLength(7);
		expect(findElements("[data-goal-id]")).toHaveLength(4);
		holdWorkspace();
		yield* Effect.promise(refreshToday);
		yield* Effect.promise(() => eventually(() => expect(readText('[aria-label="Page health"]')).toBe("pending")));
		yield* Effect.promise(releaseWorkspace);
		yield* Effect.promise(() => eventually(() => expect(readText('[aria-label="Page health"]')).toBe("settled")));
	},
);
