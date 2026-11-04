import { Context, DateTime, Option, Schema } from "effect";

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
export const DayStart = Schema.Int.check(Schema.isBetween({ maximum: 1439, minimum: 0 }));
