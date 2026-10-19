import { Tooltip, TooltipContent, TooltipTrigger } from "#client/react/components/ui/tooltip.tsx";
import { AgeLabel, type AgeProps } from "./AgeLabel.tsx";

export { AgeTicker } from "./AgeLabel.tsx";

const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function Age(props: AgeProps) {
	return (
		<Tooltip>
			<TooltipTrigger render={<AgeLabel {...props} />} />
			<TooltipContent>{timestamp.format(props.modified)}</TooltipContent>
		</Tooltip>
	);
}
