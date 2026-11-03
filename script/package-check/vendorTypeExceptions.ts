import type { VendorType } from "#package-check/adapters/vendorTypes.ts";
import declarations from "#package-check/vendor-type-exceptions.json" with { type: "json" };

export interface VendorTypeException {
	readonly dependency: string;
	readonly files: readonly string[];
	readonly name: string;
	readonly package: string;
	readonly reason: string;
}

const vendorTypeExceptions: readonly VendorTypeException[] = declarations;

function matches(finding: VendorType, exception: VendorTypeException): boolean {
	return exception.files.includes(finding.file) && finding.dependency === exception.dependency;
}

export function vendorTypeProblems(
	name: string,
	findings: readonly VendorType[],
	registry: readonly VendorTypeException[] = vendorTypeExceptions,
): string[] {
	const exceptions = registry.filter((exception) => exception.package === name);
	return [
		...findings
			.filter((finding) => !exceptions.some((exception) => matches(finding, exception)))
			.map(
				({ dependency, file }) =>
					`${file} exposes ${dependency} types; move the provider API under adapters/ or record a named vendor-type exception with its reason`,
			),
		...exceptions.flatMap((exception) =>
			exception.files
				.filter((file) => !findings.some((finding) => finding.file === file && finding.dependency === exception.dependency))
				.map((file) => `remove stale vendor-type exception ${exception.name} for ${file}: ${exception.reason}`),
		),
	];
}
