import { Effect } from "effect";
import { expect } from "vitest";
import { developmentLifecycle } from "#test-support/developmentLifecycle.ts";

developmentLifecycle.it(
	"releases Vite and drains both output streams before its scope ends with an optimizer still building",
	[],
	function* ({ optimizerBlocked, output, startDevelopment }) {
		const running = yield* Effect.scoped(
			Effect.gen(function* () {
				const server = yield* startDevelopment();
				yield* optimizerBlocked;
				expect(yield* server.child.isRunning).toBe(true);
				return server;
			}),
		);
		expect(yield* running.child.isRunning).toBe(false);
		expect(output().stdout).toContain("development server closed");
		expect(output().stdout).toContain("development process exited");
		expect(output().stderr).toContain("development stderr ended");
	},
);
