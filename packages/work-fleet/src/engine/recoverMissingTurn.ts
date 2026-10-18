import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { DecisionResponse, WorkPublication } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function missingAcceptedTurn(error: unknown) {
	return error instanceof SessionFailure && error.code === "session-turn-missing" && error.reason === "ambiguous";
}

export const recoverMissingTurn = Effect.fn("Fleet.recoverMissingTurn")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	answer?: { readonly responses: readonly DecisionResponse[]; readonly body: string },
) {
	const record = stored.value;
	const attempt = record.attempts.at(-1);
	if (
		attempt === undefined
		|| attempt.role === "reviewer"
		|| attempt.sessionId === undefined
		|| !["submitting", "accepted", "running"].includes(attempt.status)
		|| record.attempts.slice(0, -1).some((entry) => ["submitting", "accepted", "running"].includes(entry.status))
		|| state.integrations.publication === undefined
	) {
		return undefined;
	}
	const work = yield* state.board.get(record.workId, { fresh: true });
	yield* authorizeBriefContext(record, work);
	const observed = yield* state.integrations.publication(work).pipe(Effect.result);
	if (observed._tag === "Failure") {
		return yield* waitForPublication(state, stored, observed.failure.message);
	}
	const publication = observed.success;
	const published = publication.remoteBranch || publication.pullRequest !== undefined;
	const reason = published
		? `Accepted Codex turn is not observable; found ${publication.pullRequest ?? `remote branch ${publication.branch}`}; resume as repair.`
		: `Accepted Codex turn is not observable; no remote branch ${publication.branch} or open PR exists; release and relaunch.`;
	const prompt = recoveryPrompt(record, publication, reason, answer?.body);
	const publishedDecision = record.decision?.published;
	const queued = yield* state.save(stored, {
		...record,
		attempts: record.attempts.map((entry) =>
			entry.operationId === attempt.operationId
				? { ...entry, output: reason, readRetry: undefined, sessionUnusable: true, status: "failed" as const }
				: entry,
		),
		checks: undefined,
		decision: undefined,
		decisionAcknowledged: undefined,
		decisionPublished: undefined,
		integrationRetry: undefined,
		launch: attempt.settings ?? record.launch,
		launchRetry: undefined,
		prompt,
		releaseReason: published ? record.releaseReason : reason,
		responses: answer?.responses ?? record.responses,
		review: undefined,
		stage: published ? "repairing" : "prepared",
		supersededDecisions:
			answer !== undefined || publishedDecision === undefined
				? record.supersededDecisions
				: [...(record.supersededDecisions ?? []), { published: publishedDecision, supersededAt: state.policy.now() }],
	});
	return yield* makeLaunch(state)(queued, published ? "repair" : "worker", prompt);
});

function recoveryPrompt(record: FleetRecord, publication: WorkPublication, reason: string, answer?: string) {
	const published = publication.remoteBranch || publication.pullRequest !== undefined;
	return [
		record.prompt,
		record.attempts.at(-1)?.prompt,
		reason,
		published
			? `Continue on the existing branch ${publication.branch}${publication.pullRequest === undefined ? "" : ` and PR ${publication.pullRequest}`}. Reuse them; do not create another branch or PR.`
			: undefined,
		answer,
	]
		.filter(Boolean)
		.join("\n\n");
}

const waitForPublication = Effect.fn("Fleet.waitForPublication")(function* (state: EngineState, stored: Versioned<FleetRecord>, message: string) {
	if (stored.value.decision !== undefined) {
		return yield* state.save(stored, { ...stored.value, blocker: `Cannot determine published work: ${message}` });
	}
	return yield* state.decision(
		stored,
		"session-turn-missing",
		`Accepted Codex turn is not observable; cannot determine published work: ${message}`,
		"Restore publication reads and retry, or inspect and safely release",
	);
});
