export function recoveryStatus(
	attempts: readonly { readonly publishedRecovery?: boolean | undefined; readonly output?: string | undefined }[] | undefined,
	stage: string,
) {
	const recovered = stage === "executing" ? attempts?.at(-2) : undefined;
	return recovered?.publishedRecovery === undefined ? undefined : `Lost turn relaunched. ${recovered.output ?? ""}`.trim();
}
