export function workflowJob(name: string, seconds: number, conclusion = "success") {
	return { "completed_at": new Date(seconds * 1000).toISOString(), conclusion, name, "started_at": new Date(0).toISOString() };
}
