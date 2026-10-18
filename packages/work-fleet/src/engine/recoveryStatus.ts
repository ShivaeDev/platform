export function recoveryStatus(attempts: readonly { readonly publishedRecovery?: boolean | undefined; readonly output?: string | undefined }[] = []) {
	const recovered = attempts.slice(0, -1).findLast((attempt) => attempt.publishedRecovery !== undefined);
	return recovered === undefined ? undefined : `Lost turn relaunched. ${recovered.output ?? ""}`.trim();
}
