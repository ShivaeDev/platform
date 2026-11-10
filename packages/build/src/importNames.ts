import { byText } from "#byText.ts";
import type { Code, ImportRef } from "#code.ts";

function keyOf(ref: ImportRef): string {
	return `${ref.specifier}\u0000${ref.name}`;
}

function sorted(values: readonly string[]): readonly string[] {
	return [...values].sort(byText);
}

function importLine(specifier: string, entries: readonly (readonly [ImportRef, string, boolean])[]): readonly string[] {
	const named = entries.filter(([ref]) => ref.name !== "*" && ref.name !== "default");
	const whole = entries.filter(([ref]) => ref.name === "*" || ref.name === "default");
	const allTypes = named.every(([, , typeOnly]) => typeOnly);
	const names = named.map(([ref, local, typeOnly]) => {
		const renamed = ref.name === local ? local : `${ref.name} as ${local}`;
		return typeOnly && !allTypes ? `type ${renamed}` : renamed;
	});
	return [
		...(named.length === 0 ? [] : [`import ${allTypes ? "type " : ""}{ ${sorted(names).join(", ")} } from "${specifier}";`]),
		...whole.map(([ref, local, typeOnly]) => `import ${typeOnly ? "type " : ""}${ref.name === "*" ? `* as ${local}` : local} from "${specifier}";`),
	];
}

// Gives every distinct import one local name, so two classes both called NotFound from different files both fit.
export function importNames(code: Code, reserved: ReadonlySet<string>) {
	const refs = new Map<string, ImportRef[]>();
	for (const part of code) {
		if (typeof part !== "string") {
			refs.set(keyOf(part), [...(refs.get(keyOf(part)) ?? []), part]);
		}
	}
	const taken = new Set(reserved);
	const locals = new Map<string, string>();
	for (const key of sorted([...refs.keys()])) {
		const preferred = sorted((refs.get(key) ?? []).map((ref) => ref.preferred))[0] ?? "imported";
		let chosen = preferred;
		for (let suffix = 2; taken.has(chosen); suffix += 1) {
			chosen = `${preferred}${suffix}`;
		}
		taken.add(chosen);
		locals.set(key, chosen);
	}
	const bySpecifier = new Map<string, (readonly [ImportRef, string, boolean])[]>();
	for (const [key, uses] of refs) {
		const [first] = uses;
		if (first !== undefined) {
			const entry = [first, locals.get(key) ?? first.preferred, uses.every((use) => use.typeOnly)] as const;
			bySpecifier.set(first.specifier, [...(bySpecifier.get(first.specifier) ?? []), entry]);
		}
	}
	function local(ref: ImportRef) {
		return locals.get(keyOf(ref)) ?? ref.preferred;
	}
	return {
		lines: sorted([...bySpecifier.keys()]).flatMap((specifier) => importLine(specifier, bySpecifier.get(specifier) ?? [])),
		local,
		text: (written: Code) => written.map((part) => (typeof part === "string" ? part : local(part))).join(""),
	};
}
