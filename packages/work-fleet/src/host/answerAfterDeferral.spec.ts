import { answerAfterDeferral } from "#test/answerAfterDeferral.ts";
import { answerReceiptRecovery } from "#test/answerReceiptRecovery.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

for (const type of ["clarify", "not_now"] as const) {
	for (const release of [false, true]) {
		postgresTests("live")(`a CLI ${release ? "release" : "text"} answer applies after a reconciled ${type} response`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
				withReadDaemon(fixture.host, (port) => answerAfterDeferral(fixture, port, type, release), { parts: fixture.parts }),
			),
		);
	}
}

for (const release of [false, true]) {
	for (const applied of [false, true]) {
		postgresTests("live")(`a ${release ? "release" : "text"} request restarts ${applied ? "after" : "before"} its exact response applies`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) => answerReceiptRecovery(fixture, release, applied)),
		);
	}
}
