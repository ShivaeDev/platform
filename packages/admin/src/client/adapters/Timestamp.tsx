import { DateTime } from "effect";
import { type DateDisplay, timestampText } from "#client/adapters/timestampText.ts";

export function Timestamp({
	className,
	dates,
	time,
}: {
	readonly className?: string;
	readonly dates: DateDisplay;
	readonly time: DateTime.DateTime;
}) {
	return (
		<time className={className} dateTime={DateTime.formatIso(time)}>
			{timestampText(time, dates)}
		</time>
	);
}
