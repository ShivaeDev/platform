import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { LINK, Mail, payload, queued, receivedValues } from "#test/confirmation.ts";
import { database } from "#test/postgres/database.ts";

const masked = { links: [{ href: "<redacted>" }], note: "<redacted>", subject: payload.subject, token: "<redacted>" };
const rejected = {
	_tag: "DeliveryRejected",
	message: JSON.stringify({ payload: masked }),
};

database.it("a worker receives the real one-time link, redacted note and token", queued, function* ({ handled, untilJob }) {
	yield* untilJob("confirmation", "failed");

	const received = yield* handled(Mail);
	expect(receivedValues(received)).toEqual([{ links: [LINK], note: "private note", token: payload.token }]);
});

database.it("failed and dead-letter listings and job details mask payload secrets", queued, function* ({ listed, job, untilDeadLettered }) {
	yield* untilDeadLettered(Mail, 1);

	for (const listing of ["failed", "dead-lettered"] as const) {
		const page = yield* listed("app", listing, Mail);
		expect(page.jobs.map(({ data }) => data)).toEqual([masked]);
	}
	const detail = yield* job("confirmation");
	expect(detail === "missing" ? detail : detail.data).toEqual(masked);
});

database.it(
	"failure records, worker log lines and log annotations mask payload secrets",
	queued,
	function* ({ listedOutputs, storedOutput, logged, logContext, untilJob }) {
		yield* untilJob("confirmation", "failed");

		yield* outcomes({
			"listed failure": [listedOutputs("app", "failed", Mail), [rejected]],
			"log annotations": [logContext("mail attempted"), { annotations: { component: "mail", token: "<redacted>" }, span: "the one-time-mail span" }],
			"recorded worker log": [
				Effect.map(logged("app"), (lines) => lines.filter(({ level }) => level === "Info")),
				[
					{ level: "Info", message: masked },
					{ level: "Info", message: "mail attempted" },
				],
			],
			"stored failure": [storedOutput("confirmation"), rejected],
		});
	},
);
