export function refused(line: string, cause: unknown): Error {
	return new Error(`trait "${line}" refused: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
}
