import { Effect } from "effect";
import { Window } from "happy-dom";
import { vi } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { jobBoardSession } from "#modules/notes/test-support/jobBoardSession.ts";
import { requests } from "#modules/notes/test-support/requests.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";

export const jobBoard = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		yield* Effect.acquireRelease(
			Effect.sync(() => vi.stubEnv("PGBOSS_DASHBOARD_READ_ONLY", "0")),
			() => Effect.sync(() => vi.unstubAllEnvs()),
		);
		return { cookie: "", cookies: new Map<"admin" | "user", string>(), host: yield* startHost() };
	},
	inspect: ({ host }) => ({ baseUrl: host.baseUrl }),
	layer: postgres,
	name: "job board",
	stages: ["session"],
	verbs: (engine, story) => ({
		createNote: Effect.fn("JobBoardStory.createNote")(function* (title: string) {
			const notes = yield* requests(engine.host, story.tell).notes(engine.cookie);
			return yield* notes.create({ title });
		}),
		open: Effect.fn("JobBoardStory.open")(function* (
			path: string,
			options?: { readonly as?: "admin" | "user" | "visitor"; readonly intent?: string; readonly method?: string },
		) {
			story.tell(`${options?.method ?? "GET"} ${path}`);
			let cookie: string | undefined = engine.cookie;
			if (options?.as !== undefined) {
				cookie = options.as === "visitor" ? "" : engine.cookies.get(options.as);
			}
			if (cookie === undefined) {
				return yield* Effect.die("The requested account must be signed in");
			}
			return yield* Effect.promise(async () => {
				const response = await fetch(`${engine.host.baseUrl}${path}`, {
					...(options?.intent === undefined ? {} : { body: new URLSearchParams({ intent: options.intent }) }),
					headers: { cookie, origin: engine.host.origin },
					method: options?.method ?? "GET",
					redirect: "manual",
				});
				const html = await response.text();
				const window = new Window();
				try {
					window.document.write(html);
					const payload = window.document.querySelector("pre")?.textContent;
					const data: unknown = payload === undefined ? null : JSON.parse(payload);
					return {
						assets: [...window.document.querySelectorAll("script[src], link[href]")]
							.map((element) => element.getAttribute("src") ?? element.getAttribute("href") ?? "")
							.filter((url) => url.startsWith("/admin/jobs/assets/")),
						cacheControl: response.headers.get("cache-control"),
						contentType: response.headers.get("content-type"),
						data,
						jobs: [...window.document.querySelectorAll("a[href]")]
							.map((element) => element.getAttribute("href") ?? "")
							.filter((url) => /\/jobs\/[0-9a-f-]{36}/u.test(url)),
						status: response.status,
						text: window.document.body.innerText,
					};
				} finally {
					await window.happyDOM.close();
				}
			});
		}),
	}),
});

export function boardSession(role: "admin" | "user") {
	return jobBoard.trait("session", `a ${role} is signed in`, function* (engine) {
		engine.cookie = yield* jobBoardSession(role);
		engine.cookies.set(role, engine.cookie);
	});
}
