import { REPORT_LIMITS, reportLimit } from "#reportLimits.ts";

export async function readTaskResponse(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (reader === undefined) {
		throw new Error("Cloud task download has no body");
	}
	try {
		if (Number(response.headers.get("content-length")) > REPORT_LIMITS.downloadBytes) {
			throw reportLimit("downloadBytes");
		}
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) {
				return JSON.parse(Buffer.concat(chunks).toString("utf8"));
			}
			size += chunk.value.length;
			if (size > REPORT_LIMITS.downloadBytes) {
				throw reportLimit("downloadBytes");
			}
			chunks.push(chunk.value);
		}
	} finally {
		await reader.cancel();
		reader.releaseLock();
	}
}
