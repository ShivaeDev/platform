import { expect } from "vitest";
import { outcomes } from "#server/outcomes.ts";
import { settlingPage } from "#test/settlingPage.tsx";

for (const last of ["pending work", "client activity", "transport"] as const) {
	settlingPage.it(
		`settling waits when ${last} finishes last`,
		[],
		function* ({ settle, startPreview, startRead, startAttachment, startSettling, finishPreview, preview, attachment }) {
			yield* settle();
			yield* startPreview();
			const finishRead = yield* startRead();
			const finishAttachment = yield* startAttachment();
			const settling = yield* startSettling();
			const completions = { "client activity": finishRead, "pending work": finishPreview(), transport: finishAttachment };

			for (const name of ["pending work", "client activity", "transport"] as const) {
				if (name !== last) {
					yield* completions[name];
				}
			}
			expect(yield* settling.state(last)).toBe("waiting");
			yield* completions[last];
			yield* settling.finish;

			yield* outcomes([
				["preview", preview, "Preview ready"],
				["attachment", attachment, "Attached notes"],
			]);
		},
	);
}

settlingPage.it(
	"settling observes new application work while transport is still pending",
	[],
	function* ({ settle, startAttachment, startSettling, finishPreview, preview }) {
		yield* settle();
		const finishAttachment = yield* startAttachment(true);
		const settling = yield* startSettling();

		yield* finishAttachment;
		expect(yield* settling.state("pending work")).toBe("waiting");
		yield* finishPreview();
		yield* settling.finish;

		expect(yield* preview()).toBe("Preview ready");
	},
);
