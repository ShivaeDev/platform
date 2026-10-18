export function workflowJobs(seconds: Readonly<Record<string, number>>) {
	return {
		jobs: Object.entries(seconds).map(([name, duration]) => ({
			"completed_at": new Date(duration * 1000).toISOString(),
			conclusion: "success",
			name,
			"started_at": new Date(0).toISOString(),
		})),
	};
}
