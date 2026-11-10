import type { Effect } from "effect";
import type { ScreenDriver } from "#server/screenDriver.ts";
import type { drivenClock } from "#test/drivenClock.ts";

export function drivenScreen<E>(clock: Effect.Success<typeof drivenClock>, driver: ScreenDriver<E>): ScreenDriver<E> {
	return {
		...driver,
		dialog: (target) => drivenScreen(clock, driver.dialog(target)),
		find: (target, options) => (options?.timeout === undefined ? clock.run(driver.find(target, options)) : clock.drive(driver.find(target, options))),
		findText: (text, options) =>
			options?.timeout === undefined ? clock.run(driver.findText(text, options)) : clock.drive(driver.findText(text, options)),
		gone: (target, options) => (options?.timeout === undefined ? clock.run(driver.gone(target, options)) : clock.drive(driver.gone(target, options))),
		navigatedAway: (prefix, options) =>
			options?.timeout === undefined ? clock.run(driver.navigatedAway(prefix, options)) : clock.drive(driver.navigatedAway(prefix, options)),
		settle: (options) => (options?.timeoutMs === undefined ? clock.run(driver.settle(options)) : clock.drive(driver.settle(options))),
		within: (container) => drivenScreen(clock, driver.within(container)),
	};
}
