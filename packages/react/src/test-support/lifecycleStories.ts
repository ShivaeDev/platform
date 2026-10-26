import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { activityProbe } from "./activityProbe.tsx";
import { activityRegistry } from "./activityRegistry.ts";
import { mountProbe, probeOptions } from "./lifecycleScreen.ts";
import { replayProbe } from "./replayProbe.tsx";
import { rotationProbe } from "./rotationProbe.tsx";
import { trackedProbe } from "./trackedProbe.tsx";

export const replay = storyKit(
	probeOptions("StrictMode session screen", replayProbe, (probe, screen) => ({
		signIn: (session: string) => screen.act(`sign in as ${session}`, () => probe().show(session)),
		signOut: () => screen.act("sign out", () => probe().show(undefined)),
	})),
);
export function replayMounted() {
	return replay.trait("screen", "a rendered StrictMode session", mountProbe);
}

export const activity = storyKit(
	probeOptions(
		"Activity session screen",
		(root) => activityProbe(root, false),
		(probe, screen) => ({
			hide: () => screen.act("hide the generation", () => probe().show("hidden")),
			reveal: () => screen.act("reveal the generation", () => probe().show("visible")),
		}),
	),
);
export function activityMounted(hoisted: boolean) {
	return activity.trait("screen", `a rendered Activity session (hoisted ${hoisted})`, (engine) =>
		mountProbe(engine, (root) => activityProbe(root, hoisted)),
	);
}

export const tracked = storyKit(
	probeOptions("hidden session screen", trackedProbe, (probe, screen) => ({
		hide: (generation: number) => screen.act(`hide generation ${generation}`, () => probe().show("hidden", generation)),
		reveal: (generation: number) => screen.act(`reveal generation ${generation}`, () => probe().show("visible", generation)),
	})),
);
export function trackedMounted() {
	return tracked.trait("screen", "a rendered hidden session probe", mountProbe);
}

export const rotation = storyKit(
	probeOptions("rotating session screen", rotationProbe, (probe, screen) => ({
		signIn: (...args: Parameters<ReturnType<typeof rotationProbe>["show"]>) =>
			screen.act(`sign in with credential ${args[0].credential}`, () => probe().show(...args)),
	})),
);
export function rotationMounted() {
	return rotation.trait("screen", "a rendered rotating session", mountProbe);
}

export const registryActivity = storyKit(
	probeOptions("Activity registry screen", activityRegistry, (probe, screen) => ({
		hide: (count: number) => screen.act(`show ${count} atoms while hidden`, () => probe().render("hidden", count)),
		pauseCleanup: () => {
			screen.tell("pause scheduled registry cleanup");
			vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		},
		resumeCleanup: () => {
			screen.tell("resume scheduled registry cleanup");
			vi.useRealTimers();
		},
		reveal: (count: number) => screen.act(`reveal ${count} atoms`, () => probe().render("visible", count)),
		runCleanup: () => screen.act("run pending registry cleanup", () => vi.runOnlyPendingTimers()),
	})),
);
export function registryActivityMounted() {
	return registryActivity.trait("screen", "a rendered Activity registry probe", mountProbe);
}
