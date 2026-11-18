import { DateTime, Option } from "effect";

export interface DateDisplay {
	readonly locale?: string | undefined;
	readonly timeZone?: string | undefined;
}

const STYLE = { dateStyle: "medium", timeStyle: "long" } as const;

export function timestampText(time: DateTime.DateTime, { locale, timeZone }: DateDisplay): string {
	const options = locale === undefined ? STYLE : { ...STYLE, locale };
	// Intl throws on a locale or time zone it cannot read, and a saved preference must not take the page down with it.
	const preferred = Option.liftThrowable(() =>
		timeZone === undefined ? DateTime.formatLocal(time, options) : DateTime.format(time, { ...options, timeZone }),
	)();
	return Option.getOrElse(preferred, () => DateTime.formatLocal(time, STYLE));
}
