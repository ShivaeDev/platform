import { expect, vi } from "vitest";
import { Unauthorized, Unavailable } from "#test/loaderSession.ts";
import { expiredLoaderSession, sessionLoaders } from "#test/sessionLoaderStories.tsx";

for (const mode of ["route", "direct"] as const) {
	sessionLoaders.it(
		`${mode} Unauthorized rechecks once before the auth owner ends the session`,
		[expiredLoaderSession(mode)],
		function* ({ load, fail, observe, view, applySession }) {
			yield* load();
			const failure = new Unauthorized();
			yield* fail(failure);
			yield* observe("the failed load is visible", () =>
				expect(view().root.container.querySelector("[role=alert]")?.textContent).toBe("Session expired"),
			);
			expect(vi.mocked(console.error).mock.calls.map(([, error]) => error)).toEqual(mode === "route" ? [failure] : []);
			vi.mocked(console.error).mockClear();
			expect(view().rechecks).toBe(1);
			yield* applySession();
			expect(view().root.container.textContent).toBe("Session ended");
			expect(view().rechecks).toBe(1);
		},
	);
	sessionLoaders.it(
		`${mode} failures other than Unauthorized do not recheck`,
		[expiredLoaderSession(mode)],
		function* ({ load, fail, observe, view }) {
			yield* load();
			const failure = new Unavailable();
			yield* fail(failure);
			yield* observe("the failed load is visible", () =>
				expect(view().root.container.querySelector("[role=alert]")?.textContent).toBe("Load unavailable"),
			);
			expect(vi.mocked(console.error).mock.calls.map(([, error]) => error)).toEqual(mode === "route" ? [failure] : []);
			vi.mocked(console.error).mockClear();
			expect(view().rechecks).toBe(0);
			expect(view().session).toBe("visitor");
		},
	);
}
sessionLoaders.it(
	"the sign-in redirect sees the signed-out session after an Unauthorized loader",
	[expiredLoaderSession("route")],
	function* ({ load, fail, observe, view, signIn }) {
		yield* load();
		const failure = new Unauthorized();
		yield* fail(failure);
		yield* observe("the route reports the expired session", () =>
			expect(view().root.container.querySelector("[role=alert]")?.textContent).toBe("Session expired"),
		);
		expect(vi.mocked(console.error).mock.calls.map(([, error]) => error)).toEqual([failure]);
		vi.mocked(console.error).mockClear();
		yield* signIn();
		yield* observe("sign-in stays signed out instead of redirecting back", () =>
			expect(view().root.container.textContent).toContain("Signed out: sign in"),
		);
		expect(view().rechecks).toBe(1);
	},
);
