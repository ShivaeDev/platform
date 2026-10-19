import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace, fleetWorkspaceItems } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenFleet, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"says in plain words who holds each Now card and how long it has been in its stage",
	[
		screenFiles(fleetWorkspace, { home: "home.md" }),
		screenFleet(fleetWorkspaceItems(Effect.runSync(Clock.currentTimeMillis))),
		screenRoute("/_board/work"),
		openScreen(),
	],
	function* ({ findElement, findElements, readText }) {
		function card(id: string) {
			const found = findElement(`[data-item="${id}"]`);
			return { owner: readText(".work-owner", found), stage: readText(".work-stage", found) };
		}
		yield* Effect.promise(() =>
			eventually(() => expect(card("task.upload")).toEqual({ owner: "Fleet is working on this", stage: "Executing since 4h ago" })),
		);
		expect(card("task.guide")).toEqual({ owner: "Queued for Fleet", stage: "Queued since 4h ago" });
		expect(card("task.email")).toEqual({ owner: "Needs you", stage: "Waiting since 4h ago" });
		expect(card("task.pricing")).toEqual({ owner: "Assigned to you", stage: undefined });
		expect(findElements(".work-now .work-kind")).toHaveLength(0);
	},
);
