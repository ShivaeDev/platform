import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collector, moduleWorkers, sensitiveKeys } from "#test/modules/workerStory.ts";

moduleWorkers.it(
	"a job that logs a stored member masks the address its model marks sensitive in the recorded worker log, while the card it stores keeps the address",
	[],
	function* ({ complete, joinMember, printCard, printedAddresses, recordedWorkerLog }) {
		const id = yield* joinMember("alice", "1 Elm Street");

		yield* printCard(id);
		yield* complete();

		yield* outcomes([
			["recorded worker log", () => recordedWorkerLog("member card printed"), { address: "<redacted>", id, name: "alice" }],
			["printed addresses", () => printedAddresses(), ["1 Elm Street"]],
		]);
	},
);

moduleWorkers.it(
	"a job that dies holding a stored member masks the sensitive address in its recorded worker log's defect and in the cause its error reporter receives",
	[],
	function* ({ auditMember, complete, joinMember, recordedWorkerDefect, reportedWorkerDefect }) {
		const id = yield* joinMember("alice", "1 Elm Street");

		yield* auditMember(id);
		yield* complete();

		yield* outcomes([
			["recorded worker defect", () => recordedWorkerDefect("member audit failed"), { member: { address: "<redacted>", id, name: "alice" } }],
			["reported defect", () => reportedWorkerDefect(), { member: { address: "<redacted>", id, name: "alice" } }],
		]);
	},
);

moduleWorkers.it(
	"a name listed in the worker host's config.sensitiveKeys is masked in a job's recorded worker log",
	[sensitiveKeys("customerReference")],
	function* ({ billMember, complete, joinMember, recordedWorkerLog }) {
		const id = yield* joinMember("alice", "1 Elm Street");

		yield* billMember(id);
		yield* complete();

		expect(yield* recordedWorkerLog("member billed")).toEqual({ customerReference: "<redacted>", id });
	},
);

moduleWorkers.it(
	"a name listed in the worker host's config.sensitiveKeys is masked in the failure of the line that logs a failed job attempt",
	[sensitiveKeys("customerReference")],
	function* ({ chargeMember, complete, recordedWorkerFailure }) {
		yield* chargeMember(7);
		yield* complete();

		expect(yield* recordedWorkerFailure("Job attempt failed")).toEqual({ _tag: "ChargeDeclined", customerReference: "<redacted>", id: 7 });
	},
);

moduleWorkers.it("a credential-shaped password in a log the worker writes while it starts is masked", [], function* ({ recordedWorkerLog }) {
	expect(yield* recordedWorkerLog("member mailer connected")).toEqual({ host: "smtp.example.test", password: "<redacted>" });
});

moduleWorkers.it(
	"a job's span attribute holding a stored member reaches the OTLP collector with the sensitive address masked",
	[collector],
	function* ({ complete, exportedCardSpan, joinMember, printCard }) {
		const id = yield* joinMember("alice", "1 Elm Street");

		yield* printCard(id);
		yield* complete();

		expect(yield* exportedCardSpan()).toEqual({ address: "<redacted>", id, name: "alice" });
	},
);
