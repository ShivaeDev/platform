import { Struct } from "effect";
import { statusRecord } from "#test/status.ts";

export function statusScaleRecords(): ReturnType<typeof statusRecord>[] {
	const prompt = "Implement the approved synthetic change and validate the result.\n".repeat(200);
	const context = "# Synthetic Board context\nA linked goal and its acceptance criteria.\n".repeat(150);
	const output = "Synthetic worker progress, validation logs and delivery observations.\n".repeat(150);
	return Array.from(
		{ length: 2000 },
		(_, index): ReturnType<typeof statusRecord> => ({
			...statusRecord(`item-${String(index).padStart(4, "0")}`, index < 100 ? "working" : "done"),
			attempts: [{ operationId: `operation-${index}`, output, prompt, role: "worker", status: "completed", submittedAt: 1 }],
			boardContext: context,
			completedAt: index < 100 || index % 2 === 0 ? undefined : 1000 + index,
			history: [{ ...Struct.omit(statusRecord("archived", "done"), ["workId"]), archivedAt: 1, prompt }],
			prompt,
			updatedAt: 1000 + index,
		}),
	).map(
		(record, index): ReturnType<typeof statusRecord> =>
			index === 0
				? {
						...record,
						attentionOwner: "maintainer",
						blocker: "Choose the synthetic storage option",
						decision: {
							attentionOwner: "maintainer",
							id: "storage-choice",
							links: ["decision.md"],
							publicationWork: { approved: true, context, dependsOn: [], revision: "synthetic", sourcePath: "item.md", workId: "item-0000" },
							reason: "Choose storage",
							recommendation: "Use PostgreSQL",
						},
						result: { head: "synthetic-head", kind: "change", paths: ["src/example.ts"], pr: "https://github.com/example/project/pull/1" },
						stage: "waiting",
						step: "waiting",
					}
				: record,
	);
}
