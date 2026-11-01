import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { running, runtime } from "#test/runtime/kit.ts";
import { pendingErrorReport } from "#test/runtime/pendingErrorReport.ts";

const clientError = new Error("background worker stopped");

runtime.it(
	"stopping the runtime interrupts its pending onError before release",
	[pendingErrorReport(), running("app")],
	function* ({ applicationLog, emitClientError, errorReportStarts, stop }) {
		yield* emitClientError(clientError);
		yield* errorReportStarts();
		expect(yield* applicationLog()).toEqual(["onError started: background worker stopped"]);

		yield* stop("app");

		expect(yield* applicationLog()).toEqual(["onError started: background worker stopped", "onError interrupted: background worker stopped"]);
	},
);

runtime.it(
	"stopping the runtime waits for an uninterruptible onError before release",
	[pendingErrorReport(false), running("app")],
	function* ({
		allowErrorReport,
		applicationLog,
		clientCalls,
		emitClientError,
		errorReportStarts,
		runtimeReleased,
		startStoppingDuringErrorReport,
		stopFinishes,
	}) {
		yield* emitClientError(clientError);
		yield* errorReportStarts();

		yield* startStoppingDuringErrorReport("app");

		yield* outcomes([
			["runtime released", () => runtimeReleased(), false],
			["client lifecycle", () => clientCalls(), ["start"]],
		]);

		yield* allowErrorReport();
		yield* stopFinishes();

		yield* outcomes([
			["application log", () => applicationLog(), ["onError started: background worker stopped", "onError finished: background worker stopped"]],
			["client lifecycle", () => clientCalls(), ["start", "stop"]],
		]);
	},
);

runtime.it(
	"an onError that finishes before release keeps its result when the runtime stops",
	[pendingErrorReport(), running("app")],
	function* ({ allowErrorReport, applicationLog, emitClientError, errorReportFinishes, errorReportStarts, stop }) {
		yield* emitClientError(clientError);
		yield* errorReportStarts();
		yield* allowErrorReport();
		yield* errorReportFinishes();
		expect(yield* applicationLog()).toEqual(["onError started: background worker stopped", "onError finished: background worker stopped"]);

		yield* stop("app");

		expect(yield* applicationLog()).toEqual(["onError started: background worker stopped", "onError finished: background worker stopped"]);
	},
);
