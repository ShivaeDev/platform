import type { Deferred } from "effect";
import type { SessionReceipt } from "#session/schema.ts";
import type { duplicateTurns } from "#test/duplicateTurns.ts";
import type { githubFixture } from "#test/githubChecks.ts";
import type { resultFixture } from "#test/githubResult.ts";
import type { lostTurnProvider } from "#test/lostTurnProvider.ts";
import type { missingTurnTransport } from "#test/missingTurnTransport.ts";
import type { workPublication } from "#test/workPublication.ts";

export interface EngineWorld {
	adoption?: ReturnType<typeof resultFixture> | undefined;
	checkedHeads: string[];
	checks?: ReturnType<typeof githubFixture> | undefined;
	closeDuringAssessment?: (() => void) | undefined;
	completionEdit?: (() => void) | undefined;
	conflicting: boolean;
	deliveryChanged: boolean;
	deliveryMerged: boolean;
	githubUnavailable: boolean;
	launching?: Deferred.Deferred<void> | undefined;
	lostReviews: number;
	lostTurns?: ReturnType<typeof lostTurnProvider> | undefined;
	missingReviewOperation?: string | undefined;
	missingTurns?: ReturnType<typeof missingTurnTransport> | undefined;
	movedWriteResumed: boolean;
	nativeTurns?: ReturnType<typeof duplicateTurns> | undefined;
	now: number;
	observing?: Deferred.Deferred<void> | undefined;
	providerQuota: number;
	providerReads: number;
	providerRejects: boolean;
	providerReviews: number;
	publication?: ReturnType<typeof workPublication> | undefined;
	pullObservation?: unknown | undefined;
	rejectNextSubmission?: "session" | "turn" | undefined;
	resultHead: string;
	reviewResume?: Deferred.Deferred<void> | undefined;
	terminalEvidenceRestored: boolean;
	terminalReceipts: SessionReceipt[];
}

export function worldDefaults() {
	return {
		checkedHeads: [],
		conflicting: false,
		deliveryChanged: false,
		deliveryMerged: false,
		githubUnavailable: false,
		lostReviews: 0,
		movedWriteResumed: false,
		now: 100,
		providerQuota: 100,
		providerReads: 0,
		providerRejects: false,
		providerReviews: 0,
		resultHead: "",
		terminalEvidenceRestored: false,
		terminalReceipts: [],
	};
}
