import { parseArgs } from "node:util";
import { Effect } from "effect";
import { type Options, WatchError } from "./model.ts";
export const help = `pr-watch --repo OWNER/REPO [--fleet | PR_NUMBER ...]
  --state PATH       Snapshot file (default .pr-watch/OWNER-REPO.json)
  --interval SECONDS Poll interval (default 60; slows as quota falls)
  --once             Poll once and exit
  --api-url URL      GitHub REST base URL (default https://api.github.com)
  --help             Show this help
Authentication: GH_TOKEN or GITHUB_TOKEN`;
export function argumentsFor(args: readonly string[], token: string) {
	return Effect.try({
		catch: (cause) => new WatchError({ message: cause instanceof Error ? cause.message : "Invalid arguments" }),
		try: () => {
			const { values, positionals } = parseArgs({
				allowPositionals: true,
				args: [...args],
				options: {
					"api-url": { type: "string" },
					fleet: { type: "boolean" },
					help: { type: "boolean" },
					interval: { type: "string" },
					once: { type: "boolean" },
					repo: { type: "string" },
					state: { type: "string" },
				},
			});
			if (values.help) {
				return { help: true as const };
			}
			const repository = values.repo ?? "";
			if (repository.match(/^[\w.-]+\/[\w.-]+$/u) === null) {
				throw new Error("--repo OWNER/REPO is required");
			}
			const numbers = numbersFor(positionals, values.fleet ?? false);
			const interval = intervalFor(values.interval);
			const apiUrl = apiUrlFor(values["api-url"]);
			return {
				help: false as const,
				once: values.once ?? false,
				options: {
					apiUrl,
					fleet: values.fleet ?? false,
					interval,
					numbers,
					repository,
					stateFile: values.state ?? `.pr-watch/${repository.replace("/", "-")}.json`,
					token,
				} satisfies Options,
			};
		},
	});
}
function numbersFor(positionals: readonly string[], fleet: boolean): readonly number[] {
	if (positionals.some((value) => value.match(/^[1-9]\d*$/u) === null)) {
		throw new Error("PR numbers must be positive integers");
	}
	const numbers = [...new Set(positionals.map(Number))];
	if (numbers.some((number) => !Number.isSafeInteger(number))) {
		throw new Error("Invalid PR number");
	}
	if (fleet ? numbers.length > 0 : numbers.length === 0) {
		throw new Error("Choose --fleet or one or more PR numbers");
	}
	return numbers;
}
function intervalFor(value: string | undefined): number {
	const interval = Number(value ?? 60) * 1000;
	if (!Number.isFinite(interval) || interval < 1000) {
		throw new Error("--interval must be at least one second");
	}
	return interval;
}
function apiUrlFor(value: string | undefined): string {
	const apiUrl = (value ?? "https://api.github.com").replace(/\/$/u, "");
	const url = new URL(apiUrl);
	const secure = url.protocol === "https:";
	const loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (!(secure || loopback) || url.username || url.password || url.search || url.hash) {
		throw new Error("--api-url requires HTTPS (or loopback HTTP)");
	}
	return apiUrl;
}
