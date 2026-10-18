import { optionLabel, promptHeading } from "#browser/responses/cardContext.ts";
import { Button } from "#client/react/components/ui/Button.tsx";

export function TodayOptionButton({
	disabled,
	onChoose,
	option,
	recommended,
	source,
}: {
	readonly disabled: boolean;
	readonly onChoose: () => void;
	readonly option: { readonly id: string; readonly source: string };
	readonly recommended: string | undefined;
	readonly source: { readonly label: string; readonly description: string } | undefined;
}) {
	const text = source?.label ?? optionLabel(option.id, option.source);
	const description = source?.description ?? promptHeading(option.source).rest;
	return (
		<Button
			className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
			disabled={disabled}
			onClick={onChoose}
			size="sm"
			variant="outline"
		>
			<span>
				{text}
				{recommended === text ? " · Recommended" : null}
			</span>
			{description ? <span className="font-normal text-muted-foreground text-xs">{description}</span> : null}
		</Button>
	);
}
