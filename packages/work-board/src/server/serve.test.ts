import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";

boardStory.it(
	"serves the folder and selected home from one loopback command",
	[projectFiles({ "plan.md": "# Plan" }), deferredServing],
	function* ({ launchCommand, get, rpc }) {
		const command = yield* launchCommand(["--home", "plan.md"]);
		expect(yield* command.listening()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
		expect((yield* get("/")).body).toContain("data-board-react-root");
		expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).home?.file).toBe("plan.md");
	},
);
boardStory.it(
	"selects the Inbox responder through the maintainer option",
	[projectFiles(inboxAudienceFixture("Casey")), deferredServing],
	function* ({ launchCommand, rpc }) {
		const command = yield* launchCommand(["--maintainer", "Casey"]);
		yield* command.listening();
		const inbox = yield* rpc((client) => client("work-board.inbox", undefined));
		expect(inbox.you).toHaveLength(2);
		expect(inbox.agents).toHaveLength(1);
	},
);
boardStory.it(
	"explains a missing home instead of announcing a listener",
	[projectFiles({ "plan.md": "# Plan" }), deferredServing],
	function* ({ launchCommand }) {
		const command = yield* launchCommand(["--home", "missing.md"]);
		expect((yield* command.exit()).code).not.toBe(0);
		expect(command.output()).toContain("The home file missing.md is not a markdown file in");
		expect(command.output()).not.toContain("Listening on");
	},
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	boardStory.it(
		`removes its socket and promptly stops an active subscription on ${signal}`,
		[projectFiles({ "plan.md": "# Plan" }), deferredServing],
		function* ({ launchCommand, watchProject, socketState }) {
			const command = yield* launchCommand();
			yield* command.listening();
			const events = yield* watchProject();
			expect(yield* events.next()).toEqual({ _tag: "Resync" });
			expect(socketState()?.socket).toBe(true);
			const started = performance.now();
			command.signal(signal);
			yield* command.exit();
			expect(performance.now() - started).toBeLessThan(3000);
			expect(socketState()).toBeUndefined();
		},
		10_000,
	);
}
