import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { guardLostTurn } from "#engine/guardLostTurn.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { DecisionResponse, WorkPublication } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

interface RecoveryAnswer {
	readonly body: string;
	readonly responses: readonly DecisionResponse[];
}

export function missingAcceptedTurn(error: unknown): error is SessionFailure {
	return error instanceof SessionFailure && error.code === "session-turn-missing" && error.reason === "ambiguous";
}

export const recoverMissingTurn = Effect.fn("Fleet.recoverMissingTurn")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	answer?: RecoveryAnswer,
	threadIdle?: boolean,
) {
	const record = stored.value;
	const attempt = recoverableAttempt(record);
	if (attempt === undefined || state.integrations.publication === undefined) {
		return undefined;
	}
	const safe = yield* guardLostTurn(state, stored, answer !== undefined, threadIdle);
	if (safe !== undefined) {
		return safe;
	}
	const work = yield* state.board.get(record.workId, { fresh: true });
	yield* authorizeBriefContext(record, work);
	const observed = yield* state.integrations.publication(work).pipe(Effect.result);
	if (observed._tag === "Failure") {
		return yield* waitForRecovery(state, stored, `Cannot determine published work: ${observed.failure.message}`);
	}
	const publication = observed.success;
	if (publication.pullRequest !== undefined && publication.pullRequestState !== "open") {
		return yield* waitForRecovery(
			state,
			stored,
			`PR ${publication.pullRequest} is ${publication.pullRequestState ?? "of unknown state"}; inspect delivery before continuing`,
		);
	}
	const published = publication.remoteBranch || publication.pullRequest !== undefined;
	const reason = published
		? `Accepted Codex turn is not observable; found ${publication.pullRequest ?? `remote branch ${publication.branch}`}; resume as repair.`
		: `Accepted Codex turn is not observable; no remote branch ${publication.branch} or PR exists; release and relaunch.`;
	const note = recoveryNote(publication, reason, answer?.body);
	const queued = { ...stored, value: queueRecovery(record, attempt, { answer, published, reason }, state.policy.now()) };
	return yield* makeLaunch(state)(queued, published ? "repair" : "worker", [record.prompt, note].join("\n\n"));
});

function recoveryNote(publication: WorkPublication, reason: string, answer?: string) {
	const published = publication.remoteBranch || publication.pullRequest !== undefined;
	return [
		reason,
		published
			? `Continue on the existing branch ${publication.branch}${publication.pullRequest === undefined ? "" : ` and PR ${publication.pullRequest}`}. Reuse them; do not create another branch or PR.`
			: undefined,
		answer,
	]
		.filter(Boolean)
		.join("\n\n");
}

const waitForRecovery = Effect.fn("Fleet.waitForRecovery")(function* (state: EngineState, stored: Versioned<FleetRecord>, message: string) {
	if (stored.value.decision !== undefined) {
		return yield* state.save(stored, { ...stored.value, blocker: message });
	}
	return yield* state.decision(
		stored,
		"session-turn-missing",
		`Accepted Codex turn is not observable; ${message}`,
		"Inspect published work and delivery before retrying or safely releasing",
	);
});

function recoverableAttempt(record: FleetRecord) {
	const attempt = record.attempts.at(-1);
	if (
		attempt === undefined
		|| attempt.role === "reviewer"
		|| attempt.sessionId === undefined
		|| !["submitting", "accepted", "running"].includes(attempt.status)
	) {
		return undefined;
	}
	return record.attempts.slice(0, -1).some((entry) => ["submitting", "accepted", "running"].includes(entry.status)) ? undefined : attempt;
}

function queueRecovery(
	record: FleetRecord,
	attempt: Attempt,
	recovery: { readonly answer: RecoveryAnswer | undefined; readonly published: boolean; readonly reason: string },
	now: number,
): FleetRecord {
	const { answer, published, reason } = recovery;
	const publishedDecision = record.decision?.published;
	return {
		...record,
		attempts: record.attempts.map((entry) =>
			entry.operationId === attempt.operationId
				? { ...entry, output: reason, publishedRecovery: published, readRetry: undefined, sessionUnusable: true, status: "failed" as const }
				: entry,
		),
		blocker: undefined,
		checks: undefined,
		decision: undefined,
		decisionAcknowledged: undefined,
		decisionPublished: undefined,
		integrationRetry: undefined,
		launch: attempt.settings ?? record.launch,
		launchRetry: undefined,
		responses: answer?.responses ?? record.responses,
		review: undefined,
		step: published ? "repairing" : "queued",
		supersededDecisions:
			answer !== undefined || publishedDecision === undefined
				? record.supersededDecisions
				: [...(record.supersededDecisions ?? []), { published: publishedDecision, supersededAt: now }],
	};
}
