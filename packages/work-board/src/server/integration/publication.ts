import { directoryPath, validateDirectory } from "#server/responses/publicationDirectory.ts";

export const publication = {
	directoryPath,
	validateDirectory,
} as const;
