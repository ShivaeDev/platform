import { optionText } from "#browser/responses/cardContext.ts";
import { Button } from "#client/react/components/ui/button.tsx";

export function TodayOptionButton({
	disabled,
	onChoose,
	option,
	reason,
	recommended,
	source,
}: {
	readonly disabled: boolean;
	readonly onChoose: () => void;
	readonly option: { readonly id: string; readonly source: string };
	readonly reason: string;
	readonly recommended: string | undefined;
	readonly source: { readonly label: string; readonly description: string } | undefined;
}) {
	const authored = optionText(option.id, option.source, reason);
	const text = source?.label ?? authored.label;
	const description = source?.description ?? authored.description;
	return (
		<Button
			className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
			disabled={disabled}
			onClick={onChoose}
			size="sm"
			type="button"
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
