export const REPORT_ATTACHMENT_DIRECTORY = "/tmp/fleet-report/attachments/";
export const REPORT_ATTACHMENT_MARKER = "FLEET_ATTACHMENT:";

export interface ReportFile {
	readonly bytes: Uint8Array;
	readonly path: string;
}
export interface UnavailableAttachment {
	readonly path: string;
	readonly reason: string;
}
export interface ReportAttachments {
	readonly files: readonly ReportFile[];
	readonly unavailable: readonly UnavailableAttachment[];
}

export function declaredAttachments(output: string) {
	return [
		...new Set(
			output
				.split(/\r?\n/u)
				.filter((line) => line.startsWith(REPORT_ATTACHMENT_MARKER))
				.map((line) => line.slice(REPORT_ATTACHMENT_MARKER.length).trim()),
		),
	];
}
