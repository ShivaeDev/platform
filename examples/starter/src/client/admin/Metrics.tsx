import { Card, CardContent } from "#client/ui/card.tsx";

export function Metrics({ values }: { readonly values: Readonly<Record<string, number>> }) {
	return (
		<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
			{Object.entries(values).map(([label, value]) => (
				<Card key={label}>
					<CardContent>
						<dt className="text-muted-foreground text-sm">{label}</dt>
						<dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
					</CardContent>
				</Card>
			))}
		</dl>
	);
}
