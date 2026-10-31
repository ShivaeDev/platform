import { expect } from "vitest";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";
import { incompatibleWorkResponse } from "#test/sessionTransport.ts";

const plan = screenFiles({ "plan.md": "# Plan" });

screenStory.it(
	"when the work RPC fails, the work view names the error and its message",
	[plan, screenRoute("/_board/work"), unavailableWorkspace(), openScreen()],
	function* ({ workViewProblem }) {
		expect(yield* workViewProblem()).toBe("InternalServerError: Internal server error");
	},
);

screenStory.it(
	"when the work response no longer matches the browser's schema, the work view asks for a reload",
	[plan, screenRoute("/_board/work"), incompatibleWorkResponse(), sessionScreen("response")],
	function* ({ workViewProblem }) {
		expect(yield* workViewProblem()).toBe("The browser app is out of date with the server; reload.");
	},
);
