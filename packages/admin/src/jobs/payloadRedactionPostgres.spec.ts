import { expect } from "vitest";
import { jobsStory, secretMailFails, signedInAs } from "#test/jobsStory.ts";

const masked = { href: "<redacted>", id: 42, token: "<redacted>" };

jobsStory.it(
	"the Jobs page sends masked payloads over RPC for details, failed jobs and dead-letter copies",
	[signedInAs("admin"), secretMailFails],
	function* ({ detail, failedJobs, deadLettered, lastAnswerOnTheWire }) {
		const job = yield* detail("secret mail");
		expect(job.data).toEqual(masked);
		expect(yield* lastAnswerOnTheWire()).toContain('"href":"<redacted>"');

		const failed = yield* failedJobs("mail");
		expect(failed).toMatchObject({ jobs: [{ payload: masked }] });
		expect(yield* lastAnswerOnTheWire()).not.toContain("one-time-");

		const copies = yield* deadLettered("mail");
		expect(copies).toMatchObject({ copies: [{ payload: masked }] });
		expect(yield* lastAnswerOnTheWire()).not.toContain("one-time-");
	},
);
