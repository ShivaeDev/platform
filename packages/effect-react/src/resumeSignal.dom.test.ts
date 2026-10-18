import { expect } from "vitest";
import { resumeScreen, resumes } from "#test/resumeStories.ts";

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
resumes.it("the browser window is a resume window", [resumeScreen("window")], function* ({ resume, windowEvent }) {
	yield* windowEvent();
	expect(resume().root?.container.textContent).toBe("1");
});
