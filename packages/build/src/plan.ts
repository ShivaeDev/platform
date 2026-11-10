import { Effect, Option, Path } from "effect";
import { code, type ImportRef } from "#code.ts";
import type { PlannedModule, PlannedOperation } from "#emit.ts";
import type { CodePart, DeclaredClass, ModuleFacts, OperationFacts, WireForm } from "#facts.ts";
import { byText } from "#order.ts";
import { packageScopeOf } from "#packageScope.ts";
import { rejectionsOf } from "#rejections.ts";
import { specifierFor } from "#specifiers.ts";
import { formCode } from "#wireForms.ts";

export interface Placement {
	readonly output: string;
	readonly root: string;
}

function classesIn(form: WireForm | undefined): readonly DeclaredClass[] {
	if (form === undefined) {
		return [];
	}
	switch (form.form) {
		case "class":
			return [form.declared];
		case "array":
			return classesIn(form.item);
		case "tuple":
			return form.elements.flatMap(classesIn);
		case "struct":
			return form.fields.flatMap((field) => classesIn(field.form));
		case "record":
			return classesIn(form.value);
		case "union":
			return form.members.flatMap(classesIn);
		case "nullOr":
		case "option":
			return classesIn(form.inner);
		default:
			return [];
	}
}

const classRef = Effect.fn("Build.classRef")(function* (placement: Placement, declared: DeclaredClass) {
	const specifier = yield* specifierFor(placement.root, placement.output, declared.file);
	const name = declared.exportName ?? declared.className;
	return specifier === undefined ? undefined : { name, preferred: name, specifier, typeOnly: false };
});

const codeOf = Effect.fn("Build.codeOf")(function* (placement: Placement, parts: readonly CodePart[]) {
	const path = yield* Path.Path;
	return yield* Effect.forEach(parts, (part) =>
		Effect.gen(function* () {
			if (typeof part === "string") {
				return part;
			}
			const own = !path.relative(placement.root, part.writtenIn).startsWith("..");
			const specifier =
				own || !part.specifier.startsWith("#") || part.target === undefined
					? part.specifier
					: yield* specifierFor(placement.root, placement.output, part.target);
			return { name: part.name, preferred: part.local, specifier: specifier ?? part.specifier, typeOnly: part.typeOnly } satisfies ImportRef;
		}),
	);
});

function copiedOf(placement: Placement, parts: readonly CodePart[] | undefined) {
	return parts === undefined ? Effect.succeed(undefined) : codeOf(placement, parts);
}

const operationPlan = Effect.fn("Build.operationPlan")(function* (
	placement: Placement,
	label: string,
	operation: OperationFacts,
	refuse: (message: string) => void,
) {
	const packages = new Map<string, string | undefined>();
	for (const failure of operation.failures) {
		if (failure.kind === "class" && !packages.has(failure.declared.file)) {
			const scope = yield* packageScopeOf(failure.declared.file);
			packages.set(failure.declared.file, Option.getOrUndefined(Option.map(scope, ({ manifest }) => manifest.name)));
		}
	}
	const { refusals, rejections } = rejectionsOf(label, operation.failures, (file) => packages.get(file));
	refusals.forEach(refuse);
	const refs = new Map<string, ImportRef>();
	for (const declared of [...classesIn(operation.success), ...rejections.map((rejection) => rejection.declared)]) {
		const ref = yield* classRef(placement, declared);
		if (ref === undefined) {
			refuse(
				`${label}: ${declared.className} in ${declared.file} cannot be imported by the generated file; export it from a module its package exports`,
			);
		} else {
			refs.set(`${declared.file}\u0000${declared.className}`, ref);
		}
	}
	function refOf(declared: DeclaredClass): ImportRef {
		return (
			refs.get(`${declared.file}\u0000${declared.className}`) ?? {
				name: declared.className,
				preferred: declared.className,
				specifier: declared.file,
				typeOnly: false,
			}
		);
	}
	const members = yield* Effect.forEach([operation.reads, operation.readsCollections, operation.invalidates], (parts) => copiedOf(placement, parts));
	const planned: PlannedOperation = {
		kind: operation.kind,
		members: members.filter((member) => member !== undefined),
		name: operation.name,
		payload: yield* copiedOf(placement, operation.payload),
		rejections: rejections.map(({ declared, tag }) => [tag, refOf(declared)] as const),
		success: operation.success === undefined ? code() : formCode(operation.success, (form) => refOf(form.declared)),
	};
	return planned;
});

export const plan = Effect.fn("Build.plan")(function* (placement: Placement, facts: ModuleFacts) {
	const path = yield* Path.Path;
	const refusals: string[] = [...facts.refusals];
	function refuse(message: string) {
		refusals.push(message);
	}
	const sorted = [...facts.operations].sort((left, right) => byText(left.name, right.name));
	const operations = yield* Effect.forEach(sorted, (operation) => operationPlan(placement, `${facts.name}.${operation.name}`, operation, refuse));
	const moduleSpecifier = (yield* specifierFor(placement.root, placement.output, facts.file)) ?? facts.file;
	const planned: PlannedModule = {
		exportName: facts.exportName,
		keyScope: yield* copiedOf(placement, facts.keyScope),
		middleware: yield* copiedOf(placement, facts.middleware),
		module: { name: facts.exportName, preferred: facts.exportName, specifier: moduleSpecifier, typeOnly: true },
		name: facts.name,
		operations,
		source: path.relative(placement.root, facts.file),
		subject: yield* copiedOf(placement, facts.subject),
	};
	return { planned, refusals: [...new Set(refusals)] };
});
