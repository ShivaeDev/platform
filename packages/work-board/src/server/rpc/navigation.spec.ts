import { Effect } from "effect";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { navigationFixture } from "#test/navigationFixture.ts";

boardStory.it(
	"returns compact counts without a tree and loads it independently of the shell",
	[projectFiles(navigationFixture()), boardHome("packages/README.md")],
	function* ({ client, get }) {
		const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "packages/form/README.md" })));
		expect(data).toEqual({
			counts: { goals: 0, library: 7, now: 0, system: expect.any(Number) },
			home: { file: "packages/README.md", title: "packages/README.md" },
			inboxCount: 1,
		});
		const response = yield* get("/packages/form/README.md");
		expect(response.body).toContain("data-board-react-root");
		expect(response.body).not.toContain('data-key="folder:');
	},
);
boardStory.it(
	"loads Fleet records only when Library requests them",
	[projectFiles(navigationFixture()), boardHome("packages/README.md")],
	function* ({ client }) {
		const hidden = yield* Effect.promise(() => client.run(client.api.library.run({})));
		expect(hidden.files.map((file) => file.path)).not.toContain("responses/decision.md");
		const shown = yield* Effect.promise(() => client.run(client.api.library.run({ showFleet: true })));
		const fleetFiles = shown.files.filter((file) => !hidden.files.some((listed) => listed.path === file.path));
		expect(fleetFiles.map((file) => file.path)).toEqual(["responses/decision.md"]);
		expect(hidden.fleetCount).toBe(fleetFiles.length);
	},
);
