import { withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { queuedAnswerAcknowledgement } from "#test/queuedAnswerAcknowledgement.ts";
import { queuedAnswerRecovery } from "#test/queuedAnswerRecovery.ts";

for (const stage of ["executing", "repairing"] as const) {
	postgresTests("live")(`answers during ${stage} confirm before admission and queue messages in order after it frees`, () =>
		withApprovedPrDaemon((fixture) => queuedAnswerAcknowledgement(fixture, stage)),
	);
}

postgresTests("live")("recorded guidance survives shutdown before admission frees and queues once in order after restart", () =>
	withHost({ "one.md": task("one", "approved") }, {}, queuedAnswerRecovery),
);
