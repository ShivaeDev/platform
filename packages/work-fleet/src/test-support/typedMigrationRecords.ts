import type { FleetRecord } from "#model.ts";
import { prepared } from "#test/preparation.ts";
import { migrationReceipt, migrationSettings, typedMigrationAttempt } from "#test/typedMigrationAttempt.ts";

const published = {
	itemId: "item",
	questionId: "question",
	request: "request",
	revision: "revision",
	sourcePath: "question.md",
	workId: "work",
	workRevision: "work-revision",
	workSourcePath: "work.md",
};

export function typedMigrationRecords(): readonly FleetRecord[] {
	const first: FleetRecord = {
		admissionReady: false,
		areas: ["area", "second", "area"],
		attempts: [typedMigrationAttempt, { ...typedMigrationAttempt, operationId: "second", settings: {}, terminalReceipts: [] }],
		attentionOwner: "orchestrator",
		blocker: "blocker",
		boardContext: "context",
		boardRevision: "board-revision",
		boardSourcePath: "work.md",
		checks: { evidence: ["checks"], failedChecks: [], head: "head", passed: false, pending: true, repairPrompt: "repair" },
		completedAt: 0,
		conflictRepairs: ["main"],
		cwd: "/synthetic",
		decision: {
			attentionOwner: "maintainer",
			boardAcknowledgementDisposition: "superseded",
			code: "integration-failure",
			id: "decision",
			links: ["link"],
			publicationWork: {
				approved: true,
				areas: [],
				context: "context",
				deliverable: "report",
				dependsOn: ["dependency"],
				revision: "revision",
				sourcePath: "work.md",
				status: "active",
				workId: "work",
			},
			published,
			reason: "reason",
			recommendation: "answer",
			worker: migrationReceipt,
		},
		decisionAcknowledged: false,
		decisionPublished: true,
		deliverable: "report",
		integrationRetry: { error: "integration error", failures: 1, retryAt: 2 },
		launch: migrationSettings,
		launchRetry: { prompt: "retry", rejectedAt: 3, rejections: 4, retryAt: 5 },
		mergeAreasReleased: false,
		mergeReadyAt: 6,
		mergeReadyHead: "head",
		outcome: { head: "head", revision: "revision", url: "url" },
		pendingAnswers: ["first answer", "second answer"],
		preparation: prepared(),
		prompt: "prompt",
		releaseReason: "release",
		report: { itemId: "report", receipt: migrationReceipt, revision: "revision", sourcePath: "report.md", workRevision: "work-revision" },
		responses: [
			{
				action: "continue",
				boardAcknowledged: false,
				boardAcknowledgementDisposition: "superseded",
				decisionId: "decision",
				processedAt: 7,
				published,
				questionId: "question",
				questionRevision: "revision",
				responseId: "response",
				type: "answer",
			},
		],
		result: { head: "head", kind: "change", paths: ["first", "second"], pr: "pr", prNumber: 1 },
		resultObservations: [
			{ evidence: ["none"], head: "old", kind: "no-change" },
			{ head: "head", kind: "change", paths: [], pr: "pr", prNumber: 2 },
		],
		review: { evidence: ["review"], findings: ["finding"], head: "head", receipt: migrationReceipt, repairPrompt: "repair", verdict: "changes" },
		stage: "needs-human",
		stageEnteredAt: 8,
		supersededDecisions: [
			{
				boardAcknowledged: true,
				boardAcknowledgementDisposition: "superseded",
				published,
				reassignedTo: { attentionOwner: "orchestrator", decisionId: "replacement" },
				supersededAt: 9,
			},
		],
		updatedAt: 10,
		workId: "populated",
	};
	const { workId: _workId, history: _history, ...cycle } = first;
	const alternate = { ...cycle, outcome: { evidence: ["evidence"] }, result: { evidence: [], head: "head", kind: "no-change" as const } };
	return [
		{
			...first,
			history: [
				{ ...cycle, archivedAt: 11 },
				{ ...alternate, archivedAt: 12 },
			],
		},
		{
			...alternate,
			areas: [],
			attempts: [],
			conflictRepairs: [],
			history: [],
			launch: {},
			pendingAnswers: [],
			responses: [],
			resultObservations: [],
			supersededDecisions: [],
			workId: "empty",
		},
		{ attempts: [], boardRevision: "revision", cwd: "/synthetic", preparation: prepared(), prompt: "minimal", stage: "prepared", workId: "absent" },
	];
}
