export async function waitForReact() {
	const { act } = await import("react");
	// Responses and React updates must settle together inside act.
	await act(async () => {
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
	});
}
