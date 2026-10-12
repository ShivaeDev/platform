import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";

export const REPORT_LIMITS = {
	attachmentBytes: 32 * 1024 * 1024,
	attachmentCount: 64,
	diffBytes: 8 * 1024 * 1024,
	downloadBytes: 16 * 1024 * 1024,
};

const NAMES = {
	attachmentBytes: "Total report attachment bytes",
	attachmentCount: "Report attachment count",
	diffBytes: "Downloaded report diff size",
	downloadBytes: "Downloaded report task size",
};

export function reportLimit(limit: keyof typeof REPORT_LIMITS) {
	return new BadRequest({ message: `${NAMES[limit]} limit exceeded (${REPORT_LIMITS[limit]})` });
}
