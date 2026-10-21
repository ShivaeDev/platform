export const workPhases = ["draft", "ready", "done", "deferred", "dropped", "queued", "working", "reviewing", "waiting", "released"] as const;
export type WorkPhase = (typeof workPhases)[number];
export function workPhase(status: string | undefined): WorkPhase | undefined {
	const value = status ?? "draft";
	return workPhases.find((phase) => phase === value);
}
export function heldPhase(phase: WorkPhase | undefined): boolean {
	return phase === "working" || phase === "reviewing";
}
export function closedStatus(status: string | undefined): boolean {
	return status === "done" || status === "dropped";
}
export function deferredStatus(status: string | undefined): boolean {
	return status === "deferred";
}
