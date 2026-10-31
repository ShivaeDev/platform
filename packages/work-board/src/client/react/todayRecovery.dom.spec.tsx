import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pageHealthShown } from "#test/pageHealthShown.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { todayScreen } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const UNAVAILABLE = String(HttpStatus.fromLiteral("ServiceUnavailable"));
const OK = String(HttpStatus.fromLiteral("OK"));

screenStory.it(
	"Today recovers when the reader opens it again after the workspace becomes readable",
	[todayScreen(), unavailableWorkspace(), openScreen()],
	function* ({ needsYouItems, openTodayFromNavigation, pageHealth, recoverWorkspace, todayGoalIds }) {
		expect(yield* pageHealth()).toEqual({ health: "failed", status: UNAVAILABLE });
		yield* recoverWorkspace();

		yield* openTodayFromNavigation();

		yield* outcomes({
			goals: [todayGoalIds(), expect.arrayContaining([expect.any(String)])],
			health: [pageHealth(), { health: "settled", status: OK }],
			"Needs you": [needsYouItems(), expect.arrayContaining([expect.any(String)])],
		});
	},
);

screenStory.it(
	"refreshing Today while workspace indexing waits keeps Today pending until indexing resumes",
	[todayScreen(), pageHealthShown(), openScreen()],
	function* ({ holdWorkspace, pageHealth, refreshToday, releaseWorkspace }) {
		yield* holdWorkspace();
		yield* refreshToday();
		expect(yield* pageHealth()).toEqual({ health: "pending", status: OK });

		yield* releaseWorkspace();

		expect(yield* pageHealth()).toEqual({ health: "settled", status: OK });
	},
);
