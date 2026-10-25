import type { Deferred, Effect } from "effect";
import type { BoardWork } from "#policy.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { lostReportReceipt } from "#test/report.ts";
import type { SessionNaming } from "#test/sessionNaming.ts";
import type { stalledCodex } from "#test/stalledCodex.ts";
import type { stalledProvider } from "#test/stalledProvider.ts";
import type { timeoutProvider } from "#test/timeoutProvider.ts";
import type { writeBarrier } from "#test/writeBarrier.ts";

export interface RecoveryWorld {
	barrier?: Effect.Success<typeof writeBarrier>;
	disconnect?: { reads: string[]; submissions: string[] };
	faultyProvider?: Effect.Success<ReturnType<typeof stalledProvider>>;
	gates: Record<string, Deferred.Deferred<void>>;
	holdObservation: boolean;
	interrupted: string[];
	launch?: { model: string };
	naming?: SessionNaming;
	native?: Effect.Success<ReturnType<typeof stalledCodex>>;
	readsFail: boolean;
	report?: { available: boolean; collections: number; collectionReceipts: SessionReceipt[]; publication: ReturnType<typeof lostReportReceipt> };
	reportFailure?: { work: BoardWork; path: string };
	timeout?: ReturnType<typeof timeoutProvider>["state"];
	turnHidden: boolean;
}
