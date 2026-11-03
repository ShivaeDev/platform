import type { Effect, Stream } from "effect";
import { expectTypeOf, it } from "vitest";
import { type MissingScreenPending, type ScreenDriver, type ScreenDriverOptions, screenDriver } from "#server/screenDriver.ts";
import type { ScreenSignal } from "#server/screenSignal.ts";
import type { SignalNotReceived } from "#server/until.ts";

const options: ScreenDriverOptions = {
	root: () => document.body,
	tell: () => undefined,
};

it("keeps settlement infallible when the pending signal is supplied", () => {
	const driver = screenDriver({ ...options, pending: () => false });
	expectTypeOf(driver).toEqualTypeOf<ScreenDriver>();
	expectTypeOf(driver.within("section")).toEqualTypeOf<ScreenDriver>();
	expectTypeOf(driver.dialog("dialog")).toEqualTypeOf<ScreenDriver>();
	expectTypeOf(driver.settle()).toEqualTypeOf<Effect.Effect<void>>();
});

it("exposes missing pending in the settlement error channel", () => {
	const driver = screenDriver(options);
	expectTypeOf(driver.settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
	expectTypeOf(driver.within("section").settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
	expectTypeOf(driver.dialog("dialog").settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
	expectTypeOf(screenDriver({ root: options.root, tell: options.tell }).settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
});

it("exposes a missing live hint in the error channel while client settlement stays infallible", () => {
	function forActivity(pending: ScreenSignal) {
		return screenDriver({ ...options, pending });
	}
	expectTypeOf<ReturnType<typeof forActivity>>().toEqualTypeOf<ScreenDriver<never, SignalNotReceived>>();
	expectTypeOf<ReturnType<ReturnType<typeof forActivity>["nextLiveHint"]>>().toEqualTypeOf<Effect.Effect<void, SignalNotReceived>>();
});

it("keeps settlement infallible with a native pending stream", () => {
	function forPending(pending: Stream.Stream<boolean>) {
		return screenDriver({ ...options, pending });
	}
	expectTypeOf<ReturnType<typeof forPending>>().toEqualTypeOf<ScreenDriver>();
	expectTypeOf<ReturnType<ReturnType<typeof forPending>["settle"]>>().toEqualTypeOf<Effect.Effect<void>>();
});

it("keeps settlement and live hints typed with activity and combined completion sources", () => {
	function combined(activity: ScreenSignal, pending: Stream.Stream<boolean>, transport: Stream.Stream<boolean>) {
		return screenDriver({ ...options, activity, pending, transport });
	}
	function activityOnly(activity: ScreenSignal) {
		return screenDriver({ ...options, activity });
	}
	function transportOnly(transport: Stream.Stream<boolean>) {
		return screenDriver({ ...options, transport });
	}
	expectTypeOf<ReturnType<typeof combined>>().toEqualTypeOf<ScreenDriver<never, SignalNotReceived>>();
	expectTypeOf<ReturnType<typeof activityOnly>>().toEqualTypeOf<ScreenDriver<never, SignalNotReceived>>();
	expectTypeOf<ReturnType<typeof transportOnly>>().toEqualTypeOf<ScreenDriver>();
});
