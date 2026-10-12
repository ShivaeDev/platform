import { Effect } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export function reportContent(work: BoardWork, observation: SessionObservation) {
	const { provenance, itemId } = reportIdentity(work, observation.receipt);
	const metadata = { id: itemId, kind: "result", relationships: [{ kind: "informs", target: work.workId }] };
	const content = `---\n${JSON.stringify(metadata)}\n---\n# Fleet report\n\n## Worker receipt\n\n\`\`\`json\n${JSON.stringify(provenance)}\n\`\`\`\n\n## Report\n\n${observation.output}`;
	return new TextEncoder().encode(content).length > 256 * 1024
		? Effect.fail(
				new BoardFailure({
					code: "report-too-large",
					message: "Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.",
				}),
			)
		: Effect.succeed(content);
}
