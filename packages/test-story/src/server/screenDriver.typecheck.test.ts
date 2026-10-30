import type { Effect } from "effect";
import { expectTypeOf, it } from "vitest";
import { type MissingScreenPending, type ScreenDriver, type ScreenDriverOptions, screenDriver } from "#screenDriver.ts";

const options: ScreenDriverOptions = {
	root: () => document.body,
	tell: () => undefined,
};

it("keeps settlement infallible when the pending signal is supplied", () => {
	const driver = screenDriver({ ...options, pending: () => false });
	expectTypeOf(driver).toEqualTypeOf<ScreenDriver>();
	expectTypeOf(driver.within("section")).toEqualTypeOf<ScreenDriver>();
	expectTypeOf(driver.settle()).toEqualTypeOf<Effect.Effect<void>>();
});

it("exposes missing pending in the settlement error channel", () => {
	const driver = screenDriver(options);
	expectTypeOf(driver.settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
	expectTypeOf(driver.within("section").settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
	expectTypeOf(screenDriver({ root: options.root, tell: options.tell }).settle()).toEqualTypeOf<Effect.Effect<void, MissingScreenPending>>();
});
