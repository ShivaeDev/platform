import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";
import { incompatibleWorkResponse } from "#test/sessionTransport.ts";

screenStory.it(
	"explains the failed work RPC with its error tag and message",
	[screenFiles({ "plan.md": "# Plan" }), screenRoute("/_board/work"), unavailableWorkspace(), openScreen()],
	function* ({ readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText("#doc [data-slot=empty-description]")).toBe("InternalServerError: Internal server error")),
		);
	},
);

screenStory.it(
	"asks for a reload when the work response no longer matches the browser's schema",
	[screenFiles({ "plan.md": "# Plan" }), screenRoute("/_board/work"), incompatibleWorkResponse(), sessionScreen("response")],
	function* ({ readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText("#doc [data-slot=empty-description]")).toBe("The browser app is out of date with the server; reload.")),
		);
	},
);
