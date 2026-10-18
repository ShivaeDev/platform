import { expect } from "vitest";
import { pendingCommands, toggleScreen } from "#test/pendingCommandStories.tsx";

pendingCommands.it("a list toggle displays the wanted value before its command answers", [toggleScreen()], function* ({ observe, click, snapshot }) {
	yield* observe("the server row is disabled", () => expect(snapshot().server).toBe("false"));
	yield* click();
	expect(snapshot()).toMatchObject({ command: "Initial", enabled: true, pending: true, server: "false" });
});

pendingCommands.it(
	"a successful command keeps its wanted value until every watched invalidated query refetches",
	[toggleScreen()],
	function* ({ observe, click, commandSucceeds, listResponds, countResponds, snapshot }) {
		yield* observe("the server row is disabled", () => expect(snapshot().server).toBe("false"));
		yield* click();
		yield* commandSucceeds();
		yield* observe("the command has answered while refetches wait", () => expect(snapshot().command).toBe("Success"));
		expect(snapshot()).toMatchObject({ enabled: true, pending: true, server: "false" });
		yield* listResponds(false);
		expect(snapshot()).toMatchObject({ enabled: true, pending: true });
		yield* countResponds(0);
		yield* observe("the server is authoritative after both refetches", () => expect(snapshot()).toMatchObject({ enabled: false, pending: false }));
	},
);

pendingCommands.it(
	"a refetched list adopts the server's enabled value",
	[toggleScreen()],
	function* ({ observe, click, commandSucceeds, listResponds, countResponds, snapshot }) {
		yield* observe("the server row is disabled", () => expect(snapshot().server).toBe("false"));
		yield* click();
		yield* commandSucceeds();
		yield* countResponds(1);
		expect(snapshot()).toMatchObject({ enabled: true, pending: true, server: "false" });
		yield* listResponds(true);
		yield* observe("the enabled server row is visible", () => expect(snapshot()).toMatchObject({ enabled: true, pending: false, server: "true" }));
	},
);

pendingCommands.it(
	"a typed command failure reverts the toggle and preserves its rejection fields",
	[toggleScreen()],
	function* ({ observe, click, commandFails, snapshot }) {
		yield* observe("the server row is disabled", () => expect(snapshot().server).toBe("false"));
		yield* click();
		expect(snapshot().enabled).toBe(true);
		yield* commandFails("This row is locked");
		yield* observe("the rejection reverts the displayed value", () =>
			expect(snapshot()).toEqual({
				command: "Failure",
				enabled: false,
				failure: "ToggleRejected: This row is locked",
				pending: false,
				server: "false",
			}),
		);
	},
);
