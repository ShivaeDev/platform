import type { FleetRecord } from "#model.ts";
import { prepared } from "#test/preparation.ts";

export function migrationRecords(): readonly FleetRecord[] {
	const first: FleetRecord = {
		areas: ["example/storage"],
		attempts: [
			{
				operationId: "operation-one",
				output: 'Unicode Ω\nquoted "text"',
				receipt: { sessionId: "session-one", turnId: "turn-one" },
				role: "worker",
				sessionId: "session-one",
				status: "completed",
				submittedAt: 100,
			},
		],
		attentionOwner: "orchestrator",
		boardContext: "Context\nwith newlines",
		boardRevision: "revision-one",
		cwd: "/synthetic",
		mergeReadyAt: 123,
		preparation: prepared(),
		prompt: "Synthetic migration work",
		stage: "prepared",
		workId: "one",
	};
	const { workId: _workId, history: _history, ...cycle } = first;
	return [
		first,
		{
			...first,
			areas: [],
			attempts: [],
			boardRevision: "revision-two",
			history: [{ ...cycle, archivedAt: 200 }],
			mergeAreasReleased: true,
			workId: "two",
		},
	];
}
