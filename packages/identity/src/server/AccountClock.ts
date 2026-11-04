import { Context, DateTime, Effect, Option, Schema } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { AccountPreferencesStore } from "#server/AccountPreferencesStore.ts";
import { Subject } from "#subject.ts";

export const LogicalDay = Schema.String.check(
	Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
	Schema.makeFilter(
		(value) => {
			const parsed = DateTime.make(value);
			return Option.isSome(parsed) && DateTime.formatIsoDateUtc(parsed.value) === value;
		},
		{ expected: "an ISO calendar date" },
	),
);

export const AccountDayStart = Context.Reference<number>("@shivaedev/identity/AccountDayStart", { defaultValue: () => 0 });

const DayStart = Schema.Int.check(Schema.isBetween({ maximum: 1439, minimum: 0 }));

export const AccountClock = defineService({
	id: "@shivaedev/identity/AccountClock",
	initialize: Effect.gen(function* () {
		const { id } = yield* Subject;
		const { timezone } = yield* (yield* AccountPreferencesStore).get(id);
		const minutes = yield* Schema.decodeUnknownEffect(DayStart)(yield* AccountDayStart);
		return { minutes, timezone };
	}),
	methods: ({ minutes, timezone }) => {
		const decodeDay = Schema.decodeUnknownEffect(LogicalDay);
		function boundary(day: string) {
			return DateTime.toUtc(
				DateTime.makeZonedUnsafe(`${day}T00:00:00.000Z`, {
					adjustForTimeZone: true,
					disambiguation: "compatible",
					timeZone: timezone,
				}).pipe(DateTime.setParts({ hour: Math.floor(minutes / 60), minute: minutes % 60 })),
			);
		}
		return {
			dayRange: (day: string) =>
				Effect.gen(function* () {
					yield* decodeDay(day);
					const next = DateTime.makeUnsafe(day).pipe(DateTime.add({ days: 1 }), DateTime.formatIsoDateUtc);
					return { end: boundary(next), start: boundary(day) };
				}),
			logicalDay: (instant?: DateTime.Utc) =>
				Effect.gen(function* () {
					const now = instant ?? (yield* DateTime.now);
					const local = DateTime.setZoneNamedUnsafe(now, timezone);
					const day = DateTime.formatIsoDate(local);
					return DateTime.isLessThan(now, boundary(day))
						? DateTime.makeUnsafe(day).pipe(DateTime.subtract({ days: 1 }), DateTime.formatIsoDateUtc)
						: day;
				}),
		};
	},
	requires: [AccountPreferencesStore, Subject, AccountDayStart],
});
