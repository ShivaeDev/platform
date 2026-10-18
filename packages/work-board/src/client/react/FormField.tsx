import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { useField } from "@shivaedev/effect-form/client/react.ts";
import type { Fields, Form, Name } from "@shivaedev/effect-form/shape.ts";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export function FormField<TFields extends Fields, A, E, TRuntimeError>({
	form,
	name,
	label,
	maxLength,
	required,
	rows,
	children,
	autoComplete,
	showErrors = true,
}: {
	readonly form: Form<TFields, A, E, TRuntimeError>;
	readonly name: Name<TFields>;
	readonly label: string;
	readonly maxLength?: number;
	readonly required?: boolean;
	readonly rows?: number;
	readonly children?: ReactNode;
	readonly autoComplete?: string;
	readonly showErrors?: boolean;
}) {
	const field = useField(form, name);
	const ref = useRef<Control | null>(null);
	const id = useId();
	const value = typeof field.value === "string" ? field.value : "";
	const validation = name === "author" && !value.trim() ? "Add your local author label." : field.error;
	const error = showErrors ? validation : undefined;
	useLayoutEffect(() => ref.current?.setCustomValidity(error ?? ""), [error]);
	const props = {
		"aria-describedby": `${id}-error`,
		"aria-invalid": Boolean(error),
		className: "w-full rounded-md border bg-background px-3 py-2 text-sm",
		id,
		name,
		onBlur: field.onBlur,
		ref: (element: Control | null) => {
			ref.current = element;
		},
		required,
		value,
	};
	function change(next: string) {
		form.values.set({ ...form.values.value, [name]: next || (name === "supersedes" ? undefined : "") });
		form.blur(name);
	}
	let control: ReactNode;
	if (children) {
		control = (
			<select {...props} onChange={(event) => change(event.currentTarget.value)} onInput={(event) => change(event.currentTarget.value)}>
				{children}
			</select>
		);
	} else if (rows) {
		control = <textarea {...props} maxLength={maxLength} onInput={(event) => change(event.currentTarget.value)} rows={rows} />;
	} else {
		control = <input {...props} autoComplete={autoComplete} maxLength={maxLength} onInput={(event) => change(event.currentTarget.value)} />;
	}
	return (
		<label className="grid gap-2 text-sm" htmlFor={id}>
			{label}
			{control}
			<span className="response-field-error text-destructive text-xs" hidden={!error} id={`${id}-error`}>
				{error}
			</span>
		</label>
	);
}
