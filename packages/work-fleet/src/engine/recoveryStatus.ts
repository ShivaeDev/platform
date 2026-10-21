export function recoveryStatus(
	attempts: readonly { readonly publishedRecovery?: boolean | undefined; readonly output?: string | undefined }[] | undefined,
	step: string,
) {
	const recovered = step === "working" ? attempts?.at(-2) : undefined;
	return recovered?.publishedRecovery === undefined ? undefined : `Lost turn relaunched. ${recovered.output ?? ""}`.trim();
}
