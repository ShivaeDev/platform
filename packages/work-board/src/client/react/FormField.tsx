import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { useField } from "@shivaedev/effect-form/client/react.ts";
import type { Fields, Form, Name } from "@shivaedev/effect-form/shape.ts";
import { Input } from "#client/react/components/ui/input.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/react/components/ui/select.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";

const UNSET = "unset";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
export function FormField<TFields extends Fields, A, E, TRuntimeError>({
	form,
	name,
	label,
	maxLength,
	required,
	rows,
	options,
	className,
	showErrors = true,
}: {
	readonly form: Form<TFields, A, E, TRuntimeError>;
	readonly name: Name<TFields>;
	readonly label: string;
	readonly maxLength?: number;
	readonly required?: boolean;
	readonly rows?: number;
	readonly options?: readonly { readonly value: string; readonly label: string }[];
	readonly className?: string;
	readonly showErrors?: boolean;
}) {
	const field = useField(form, name);
	const ref = useRef<Control | null>(null);
	const id = useId();
	const value = typeof field.value === "string" ? field.value : "";
	const error = showErrors ? field.error : undefined;
	useLayoutEffect(() => ref.current?.setCustomValidity(error ?? ""), [error]);
	const props = {
		"aria-describedby": `${id}-error`,
		"aria-invalid": Boolean(error),
		id,
		onBlur: field.onBlur,
		ref: (element: Control | null) => {
			ref.current = element;
		},
	};
	function change(next: string) {
		form.values.set({ ...form.values.value, [name]: next || (name === "supersedes" ? undefined : "") });
		form.blur(name);
	}
	let control: ReactNode;
	if (options) {
		control = (
			<Select
				items={options.map((option) => ({ label: option.label, value: option.value || UNSET }))}
				name={name}
				onValueChange={(next) => change(next === null || next === UNSET ? "" : next)}
				required={Boolean(required)}
				value={value || UNSET}
			>
				<SelectTrigger {...props} className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value || UNSET} value={option.value || UNSET}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	} else if (rows) {
		control = (
			<Textarea
				{...props}
				className={className}
				maxLength={maxLength}
				name={name}
				onInput={(event) => change(event.currentTarget.value)}
				required={required}
				rows={rows}
				value={value}
			/>
		);
	} else {
		control = (
			<Input {...props} maxLength={maxLength} name={name} onInput={(event) => change(event.currentTarget.value)} required={required} value={value} />
		);
	}
	return (
		<div className="grid gap-2 text-sm">
			<Label className="font-normal" htmlFor={id}>
				{label}
			</Label>
			{control}
			<span className="response-field-error text-destructive text-xs" hidden={!error} id={`${id}-error`}>
				{error}
			</span>
		</div>
	);
}
