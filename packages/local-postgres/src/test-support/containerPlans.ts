import { PINNED_IMAGE } from "#test/dockerScript.ts";

const CONTAINER_ID = "container-id";
const DISCOVER = ["ps", "--filter", "publish=55432", "--format", "{{.ID}}"];

export const daemonAnswers = { args: ["info"], result: "Docker is available" };

export function containerPlan(state: "existing" | "missing" | "outdated") {
	return [
		daemonAnswers,
		{
			args: ["container", "inspect", "development-postgres"],
			result: state === "missing" ? new Error("No such container: development-postgres") : "[]",
		},
		...(state === "missing"
			? [
					{
						args: [
							"run",
							"--detach",
							"--name",
							"development-postgres",
							"--publish",
							"127.0.0.1:55432:5432",
							"--env",
							"POSTGRES_USER=postgres",
							"--env",
							"POSTGRES_PASSWORD=postgres",
							"--mount",
							"type=volume,src=development-postgres,dst=/var/lib/postgresql",
							PINNED_IMAGE,
						],
						result: "new-container-id\n",
					},
				]
			: [
					{
						args: ["inspect", "--format", "{{.Config.Image}}", "development-postgres"],
						result: state === "outdated" ? "postgres:17-alpine" : PINNED_IMAGE,
					},
					...(state === "existing" ? [{ args: ["start", "development-postgres"], result: "development-postgres\n" }] : []),
				]),
	];
}

export function publishedBy(ids: string, image = PINNED_IMAGE) {
	return [
		{ args: DISCOVER, result: ids },
		...(ids.trim() && !ids.trim().includes("\n") ? [{ args: ["inspect", "--format", "{{.Config.Image}}", ids.trim()], result: image }] : []),
	];
}

export function unanswered(checks: number) {
	return Array.from({ length: checks }, () => ({ args: DISCOVER, result: "" }));
}

export function answers(query: string, answer: string) {
	return [
		...publishedBy(`${CONTAINER_ID}\n`),
		{
			args: [
				"exec",
				"--env",
				"PGPASSWORD",
				CONTAINER_ID,
				"psql",
				"-X",
				"--set",
				"ON_ERROR_STOP=1",
				"-At",
				"-c",
				query,
				"--dbname",
				"postgresql://postgres@127.0.0.1:5432/postgres?connect_timeout=3",
			],
			result: `${answer}\n`,
		},
	];
}
