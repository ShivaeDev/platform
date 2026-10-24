import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";

export function attachmentChange(path: string, type: "update" | "delete", diff: string, movePath: string | null = null) {
	return {
		changes: [{ diff, kind: { "move_path": movePath, type }, path: `${REPORT_ATTACHMENT_DIRECTORY}${path}` }],
		id: `${type}-${path}`,
		type: "fileChange",
	};
}
