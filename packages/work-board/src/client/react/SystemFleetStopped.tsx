import { useId } from "react";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "#client/react/components/ui/card.tsx";
import { ObservedTime } from "./diagnosticsValues.tsx";
import { FleetStopped } from "./FleetStopped.tsx";

export function SystemFleetStopped({
	command,
	observedAt,
	reason,
}: {
	readonly command: string;
	readonly observedAt: number;
	readonly reason: string;
}) {
	const headingId = useId();
	return (
		<article aria-labelledby={headingId} className="min-w-0 [overflow-wrap:anywhere]" data-source="fleet" data-state="stopped">
			<Card>
				<CardHeader>
					<CardTitle>
						<h2 className="text-lg" id={headingId}>
							Fleet
						</h2>
					</CardTitle>
					<CardAction>
						<Badge variant="secondary">Not running</Badge>
					</CardAction>
				</CardHeader>
				<CardContent>
					<FleetStopped command={command} reason={reason}>
						<p className="text-muted-foreground m-0">Codex and GitHub limits and the Fleet work list come through Fleet, so they are unknown too.</p>
					</FleetStopped>
				</CardContent>
				<CardFooter className="text-muted-foreground text-xs">
					<p>
						Observed <ObservedTime at={observedAt} />
					</p>
				</CardFooter>
			</Card>
		</article>
	);
}
