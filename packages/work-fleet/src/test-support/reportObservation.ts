export function observation(output: string, turnId = "first") {
	return { execution: "completed", output, provisioning: "unknown", receipt: { sessionId: "worker", turnId } } as const;
}
export function bytes(text: string) {
	return new TextEncoder().encode(text).length;
}
