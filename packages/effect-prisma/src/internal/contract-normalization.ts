const timestampReference = /\b(?:Timestamp|Timestamptz)<(?:\d+|undefined)>/g;
const timestampCodecReference =
	/\bCodecTypes\['pg\/(?:timestamp|timestamptz)@1'\]\['(?:input|output)'\]/g;
const unsupportedTimestampReference = /\b(?:Timestamp|Timestamptz)\s*</;

/**
 * Align Prisma Next's generated PostgreSQL timestamp declarations with the
 * JavaScript Dates accepted and returned by its runtime codecs.
 */
export const normalizePrismaNextContractTypes = (source: string): string => {
	const normalized = source
		.replaceAll(timestampReference, "Date")
		.replaceAll(timestampCodecReference, "Date");

	if (unsupportedTimestampReference.test(normalized)) {
		throw new Error(
			"Unsupported Prisma Next timestamp declaration; update effect-prisma before using this generated contract",
		);
	}

	return normalized;
};
