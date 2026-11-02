import type { Effect, Stream } from "effect";
import { expectTypeOf, it } from "vitest";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { type MissingScreenPending, type ScreenDriver, type ScreenDriverOptions, screenDriver } from "#screenDriver.ts";

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

it("keeps client settlement and live hint waiting infallible", () => {
	function forActivity(pending: ClientActivity) {
		return screenDriver({ ...options, pending });
	}
	expectTypeOf<ReturnType<typeof forActivity>>().toEqualTypeOf<ScreenDriver<never, never>>();
	expectTypeOf<ReturnType<ReturnType<typeof forActivity>["nextLiveHint"]>>().toEqualTypeOf<Effect.Effect<void>>();
});

it("keeps settlement infallible with a native pending stream", () => {
	function forPending(pending: Stream.Stream<boolean>) {
		return screenDriver({ ...options, pending });
	}
	expectTypeOf<ReturnType<typeof forPending>>().toEqualTypeOf<ScreenDriver>();
	expectTypeOf<ReturnType<ReturnType<typeof forPending>["settle"]>>().toEqualTypeOf<Effect.Effect<void>>();
});
