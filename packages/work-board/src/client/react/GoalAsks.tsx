import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#client/react/components/ui/popover.tsx";

type Ask = GoalsProjection["goals"][number]["asks"][number];
const AMBER_LINK = "h-auto p-0 font-medium text-needs-you text-sm underline underline-offset-4";

export function GoalAsks({ asks }: { readonly asks: readonly [Ask, ...Ask[]] }) {
	const [only] = asks;
	if (asks.length === 1) {
		return (
			<a className={AMBER_LINK} data-goal-open-asks="" href={only.href} title={only.reason}>
				1 open ask
			</a>
		);
	}
	return (
		<Popover>
			<PopoverTrigger data-goal-open-asks="" render={<Button className={AMBER_LINK} type="button" variant="link" />}>
				{asks.length} open asks
			</PopoverTrigger>
			<PopoverContent align="start" className="max-h-[60vh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto text-sm">
				<PopoverTitle>Open asks</PopoverTitle>
				<AskList asks={asks} />
			</PopoverContent>
		</Popover>
	);
}
function AskList({ asks }: { readonly asks: readonly Ask[] }) {
	return (
		<ul className="!m-0 !list-none space-y-2 !p-0" data-goal-ask-list="">
			{asks.map((ask) => (
				<li key={ask.href}>
					<a className="font-medium" href={ask.href}>
						{ask.title}
					</a>
					<span className="text-muted-foreground block text-xs">{ask.reason}</span>
				</li>
			))}
		</ul>
	);
}
