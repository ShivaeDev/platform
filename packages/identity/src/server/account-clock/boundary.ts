import { DateTime, Effect } from "effect";

export const boundary = Effect.fn("AccountClock.boundary")((day: string, timeZone: DateTime.TimeZone, minutes: number) =>
	Effect.sync(() =>
		DateTime.toUtc(
			DateTime.makeZonedUnsafe(`${day}T00:00:00.000Z`, {
				adjustForTimeZone: true,
				disambiguation: "compatible",
				timeZone,
			}).pipe(DateTime.setParts({ hour: Math.floor(minutes / 60), minute: minutes % 60 })),
		),
	),
);
