import { expect } from "vitest";
import { liveResumeScreen, resumeScreen, resumes } from "#test/resumeStories.ts";

resumes.it(
	"visible resume and reconnect refresh; hidden events do not; unmount removes listeners",
	[resumeScreen("browser-native")],
	function* ({ resume, browserEvent, nativeEvent, close }) {
		const { fresh, browser, native } = resume();
		expect(fresh.reads()).toBe(1);
		yield* browserEvent("visibilitychange");
		expect(fresh.reads()).toBe(2);
		yield* browserEvent("visibilitychange", "hidden");
		yield* browserEvent("online", "hidden");
		expect(fresh.reads()).toBe(2);
		yield* browserEvent("online");
		expect(fresh.reads()).toBe(3);
		yield* nativeEvent();
		expect(fresh.reads()).toBe(4);
		expect(browser.listeners.size).toBe(2);
		expect(native.listeners.size).toBe(1);
		yield* close();
		expect(browser.listeners.size).toBe(0);
		expect(native.listeners.size).toBe(0);
	},
);
resumes.it("SWR revalidates stale data on resume and retains fresh data", [resumeScreen("swr")], function* ({ resume, nativeEvent, close }) {
	const { fresh, stale, native } = resume();
	expect([fresh.reads(), stale.reads()]).toEqual([1, 1]);
	yield* nativeEvent();
	expect([fresh.reads(), stale.reads()]).toEqual([1, 2]);
	yield* close();
	expect(native.listeners.size).toBe(0);
});

for (const source of ["native", "browser"] as const) {
	resumes.it(`session live queries reconcile on ${source} resume and reconnect after interruption`, [liveResumeScreen(source)], function* (test) {
		yield* test.observe("the initial notes render", () => {
			expect(test.text()).toBe("One / Two");
			expect(test.resume().root?.container.querySelector("output")?.getAttribute("data-live")).toBe("live");
		});
		yield* test.externalRename(1, "Changed while away");
		yield* test.externalRename(2, "Also changed while away");
		expect(test.text()).toBe("One / Two");
		if (source === "native") {
			yield* test.nativeEvent();
		} else {
			yield* test.visibilityEvent();
		}
		yield* test.observe("resume reconciles every mounted query", () => expect(test.text()).toBe("Changed while away / Also changed while away"));
		yield* test.observe("resume reopens the subscription", () => expect(test.connections()).toBe(2));
		expect(test.resume().native.listeners.size).toBe(source === "native" ? 1 : 0);
		yield* test.disconnect();
		yield* test.observe("the interrupted stream closes", () => expect(test.active()).toBe(0));
		yield* test.externalRename(1, "Changed while disconnected");
		if (source === "native") {
			yield* test.nativeEvent();
		} else {
			yield* test.windowEvent();
		}
		yield* test.observe("the reconnected stream reconciles missed changes", () => {
			expect(test.connections()).toBe(3);
			expect(test.text()).toBe("Changed while disconnected / Also changed while away");
		});
		yield* test.close();
		expect(test.resume().native.listeners.size).toBe(0);
		yield* test.observe("registry disposal releases the stream", () => expect(test.active()).toBe(0));
	});
}
resumes.it("the browser window is a resume window", [resumeScreen("window")], function* ({ resume, windowEvent }) {
	yield* windowEvent();
	expect(resume().root?.container.textContent).toBe("1");
});
