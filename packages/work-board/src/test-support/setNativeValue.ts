export function setNativeValue(field: { value: string }, value: string) {
	Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set?.call(field, value);
}
