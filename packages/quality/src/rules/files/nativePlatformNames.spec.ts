import { expect } from "vitest";
import { folderNames } from "#rules/files/folderNames.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { otherNames } from "#rules/files/otherNames.ts";
import { capacitorFiles } from "#test/capacitorFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const capacitorElsewhere = capacitorFiles.map((file) => ({
	...file,
	path: file.path.replace(/^ios\//u, "shells/apple/").replace(/^android\//u, "shells/mobile/"),
}));

for (const rule of [folderNames, otherNames]) {
	ruleStory.it(
		`${rule.id} accepts Capacitor 8's generated iOS and Android projects without options`,
		[repositoryHas(...capacitorFiles)],
		function* ({ check }) {
			expect(yield* check(rule)).toEqual([]);
		},
	);

	ruleStory.it(
		`${rule.id} recognises Capacitor's native projects outside the ios/ and android/ folders`,
		[repositoryHas(...capacitorElsewhere)],
		function* ({ check }) {
			expect(yield* check(rule)).toEqual([]);
		},
	);

	ruleStory.it(
		`${rule.id} recognises asset catalogs, Xcode workspaces, Swift packages and qualified Android resources by their context`,
		[
			repositoryHas(
				{ content: "", path: "desktop/Build.xcodeproj/Contents.json" },
				{ content: "", path: "desktop/Build.xcworkspace/Contents.json" },
				{ content: "", path: "desktop/Brand.xcassets/BrandLogo.imageset/Brand_Logo@2x.png" },
				{ content: "{}", path: "desktop/Brand.xcassets/BrandLogo.imageset/Contents.json" },
				{ content: "", path: "libraries/NativeKit/Package.swift" },
				{ content: "", path: "libraries/NativeKit/Sources/MyTarget/main.swift" },
				{ content: "", path: "mobile/src/main/AndroidManifest.xml" },
				{ content: "", path: "mobile/src/demoDebug/res/values-night/theme_colors.xml" },
				{ content: "", path: "mobile/src/main/res/drawable-en-rUS/button_background.9.png" },
				{ content: "", path: "standalone/src/integrationTest/AndroidManifest.xml" },
				{ content: "", path: "standalone/src/integrationTest/res/mipmap-hdpi/ic_launcher_round.png" },
			),
		],
		function* ({ check }) {
			expect(yield* check(rule)).toEqual([]);
		},
	);
}

const besideCapacitor = repositoryHas(
	...capacitorFiles,
	{ content: "export function loadItem() {}", path: "ios/wrong-name.ts" },
	{ content: "export function loadItem() {}", path: "android/wrong-name.js" },
	{ content: "", path: "ios/src/WrongFolder/value.ts" },
	{ content: "", path: "ios/App/App/WrongFolder/value.ts" },
	{ content: "", path: "android/assets/Bad_Image.png" },
	{ content: "", path: "ios/App/App/Bad_Image.png" },
);

const authoredBeside = [
	[folderNames, "folders", ["ios/App/App/WrongFolder", "ios/src/WrongFolder"]],
	[otherNames, "assets", ["android/assets/Bad_Image.png", "ios/App/App/Bad_Image.png"]],
	[namedAfterExport, "modules", ["android/wrong-name.js", "ios/wrong-name.ts"]],
] as const;

for (const [rule, authored, expected] of authoredBeside) {
	ruleStory.it(
		`${rule.id} still reports misnamed ${authored} the author adds beside Capacitor's projects`,
		[besideCapacitor],
		function* ({ check, locations }) {
			yield* check(rule);

			expect(yield* locations()).toEqual(expected);
		},
	);
}

const outsideConventions = repositoryHas(
	{ content: "", path: "libraries/NativeKit/Package.swift" },
	{ content: "", path: "libraries/NativeKit/Sources/MyTarget/BadFolder/helper.swift" },
	{ content: "", path: "ordinary/Sources/Target/main.swift" },
	{ content: "", path: "ordinary/Contents.json" },
	{ content: "", path: "ordinary/BrandLogo.imageset/Bad_Image.png" },
	{ content: "", path: "ordinary/res/mipmap-hdpi/ic_launcher.png" },
	{ content: "", path: "ordinary/src/main/res/mipmap-hdpi/ic_launcher.png" },
	{ content: "", path: "mobile/src/main/AndroidManifest.xml" },
	{ content: "", path: "mobile/src/main/res/drawable/Bad_Image.png" },
	{ content: "", path: "mobile/src/main/res/values/BadName.xml" },
	{ content: "", path: "mobile/src/main/res/BadFolder/icon.png" },
	{ content: "", path: "mobile/src/main/res/values-Night/colors.xml" },
	{ content: "export function loadItem() {}", path: "mobile/src/main/res/raw/wrong-name.ts" },
	{ content: "export function loadItem() {}", path: "desktop/Brand.xcassets/wrong-name.js" },
);

const outside = [
	[
		folderNames,
		"folders",
		[
			"libraries/NativeKit/Sources/MyTarget/BadFolder",
			"mobile/src/main/res/BadFolder",
			"mobile/src/main/res/values-Night",
			"ordinary/BrandLogo.imageset",
			"ordinary/Sources",
			"ordinary/Sources/Target",
		],
	],
	[
		otherNames,
		"resources",
		[
			"mobile/src/main/res/drawable/Bad_Image.png",
			"mobile/src/main/res/values/BadName.xml",
			"ordinary/BrandLogo.imageset/Bad_Image.png",
			"ordinary/Contents.json",
			"ordinary/res/mipmap-hdpi/ic_launcher.png",
			"ordinary/src/main/res/mipmap-hdpi/ic_launcher.png",
		],
	],
	[namedAfterExport, "code", ["desktop/Brand.xcassets/wrong-name.js", "mobile/src/main/res/raw/wrong-name.ts"]],
] as const;

for (const [rule, named, expected] of outside) {
	ruleStory.it(
		`${rule.id} reports ${named} that break native conventions or sit outside a native project, and code inside one`,
		[outsideConventions],
		function* ({ check, locations }) {
			yield* check(rule);

			expect(yield* locations()).toEqual(expected);
		},
	);
}
