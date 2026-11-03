import type { InputEvent } from "react";

export function numberInput(field: {
	readonly name: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onBlur: () => void;
}) {
	return {
		inputMode: "decimal" as const,
		name: field.name,
		onBlur: field.onBlur,
		onInput: (event: InputEvent<HTMLInputElement>) => field.onChange(event.currentTarget.value),
		type: "text" as const,
		value: field.value,
	};
}
