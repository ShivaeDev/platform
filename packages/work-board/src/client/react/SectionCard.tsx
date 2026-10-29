import { cn } from "cn";
import { type ReactNode, useId } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "#client/react/components/ui/card.tsx";

export function SectionCard({
	id,
	title,
	description,
	action,
	className,
	children,
}: {
	readonly id?: string;
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly action?: ReactNode;
	readonly className?: string;
	readonly children?: ReactNode;
}) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className={cn("min-w-0 [overflow-wrap:anywhere]", className)} id={id}>
			<Card>
				<CardHeader>
					<CardTitle>
						<h2 className="m-0 text-lg font-semibold" id={headingId}>
							{title}
						</h2>
					</CardTitle>
					{description !== undefined && <CardDescription className="text-sm">{description}</CardDescription>}
					{action !== undefined && <CardAction>{action}</CardAction>}
				</CardHeader>
				{children !== undefined && <CardContent className="flex flex-col gap-4 text-sm">{children}</CardContent>}
			</Card>
		</section>
	);
}
