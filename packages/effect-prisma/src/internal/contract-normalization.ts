const timestampReference = /\b(?:Timestamp|Timestamptz)<(?:\d+|undefined)>/g;
const timestampCodecReference = /\bCodecTypes\['pg\/(?:timestamp|timestamptz)@1'\]\['(?:input|output)'\]/g;
const unsupportedTimestampReference = /\b(?:Timestamp|Timestamptz)\s*</;

// Prisma Next declares PostgreSQL timestamps with types other than the JavaScript Dates its runtime codecs accept and return.
export const normalizePrismaNextContractTypes = (source: string): string => {
	const normalized = source.replaceAll(timestampReference, "Date").replaceAll(timestampCodecReference, "Date");

	if (unsupportedTimestampReference.test(normalized)) {
		throw new Error("Unsupported Prisma Next timestamp declaration; update effect-prisma before using this generated contract");
	}

	return normalized;
};
