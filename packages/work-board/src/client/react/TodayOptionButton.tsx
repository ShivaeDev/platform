import type { Ref } from "react";
import { optionText } from "#browser/responses/cardContext.ts";
import { Button } from "#client/react/components/ui/button.tsx";

export function TodayOptionButton({
	disabled,
	onChoose,
	option,
	recommended,
	ref,
	source,
}: {
	readonly disabled: boolean;
	readonly onChoose: () => void;
	readonly option: { readonly id: string; readonly source: string };
	readonly recommended: string | undefined;
	readonly ref?: Ref<HTMLButtonElement> | undefined;
	readonly source: { readonly label: string; readonly description: string } | undefined;
}) {
	const authored = optionText(option.id, option.source);
	const text = source?.label ?? authored.label;
	const description = source?.description ?? authored.description;
	return (
		<Button
			className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2 text-left whitespace-normal"
			disabled={disabled}
			onClick={onChoose}
			ref={ref}
			size="sm"
			type="button"
			variant="outline"
		>
			<span>
				{text}
				{recommended === text ? " · Recommended" : null}
			</span>
			{description ? <span className="text-muted-foreground text-xs font-normal">{description}</span> : null}
		</Button>
	);
}
