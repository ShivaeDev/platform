import { expect } from "vitest";
import { dockerDaemonAnswers, noContainerPublishesPort } from "#test/postgresTraits.ts";
import { scriptDefects } from "#test/scriptDefects.ts";

scriptDefects.it("an unscripted command escapes the setup error handler as a defect", [], function* ({ checkDocker, failure }) {
	yield* checkDocker();

	expect(yield* failure()).toBe('defect: Error: Unexpected Docker call: ["info"]; expected no further command');
});

scriptDefects.it(
	"a command out of script order escapes the setup error handler as a defect",
	[noContainerPublishesPort(), dockerDaemonAnswers()],
	function* ({ checkDocker, failure }) {
		yield* checkDocker();

		expect(yield* failure()).toBe('defect: Error: Unexpected Docker call: ["info"]; expected ["ps","--filter","publish=55432","--format","{{.ID}}"]');
	},
);
