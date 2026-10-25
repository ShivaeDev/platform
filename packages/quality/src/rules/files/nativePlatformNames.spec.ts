import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { folderNames } from "#rules/files/folderNames.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { otherNames } from "#rules/files/otherNames.ts";
import { capacitorFiles } from "#test/capacitorFiles.ts";

ruleKit.it("accepts Capacitor 8's generated iOS and Android folders without options", [repositoryHas(...capacitorFiles)], function* ({ checks }) {
	expect(yield* checks(folderNames)).toEqual([]);
});

ruleKit.it("accepts Capacitor 8's generated iOS and Android assets without options", [repositoryHas(...capacitorFiles)], function* ({ checks }) {
	expect(yield* checks(otherNames)).toEqual([]);
});

ruleKit.it(
	"recognises native projects outside ios and android prefixes",
	[
		repositoryHas(
			...capacitorFiles.map((file) => ({ ...file, path: file.path.replace(/^ios\//u, "shells/apple/").replace(/^android\//u, "shells/mobile/") })),
		),
	],
	function* ({ checks }) {
		expect(yield* checks(folderNames)).toEqual([]);
		expect(yield* checks(otherNames)).toEqual([]);
	},
);

ruleKit.it(
	"keeps checking authored names beside native projects",
	[
		repositoryHas(
			...capacitorFiles,
			{ content: "export function loadItem() {}", path: "ios/wrong-name.ts" },
			{ content: "export function loadItem() {}", path: "android/wrong-name.js" },
			{ content: "", path: "ios/src/WrongFolder/value.ts" },
			{ content: "", path: "ios/App/App/WrongFolder/value.ts" },
			{ content: "", path: "android/assets/Bad_Image.png" },
			{ content: "", path: "ios/App/App/Bad_Image.png" },
		),
	],
	function* ({ checks }) {
		expect((yield* checks(folderNames)).map((finding) => finding.file)).toEqual(["ios/App/App/WrongFolder", "ios/src/WrongFolder"]);
		expect((yield* checks(otherNames)).map((finding) => finding.file)).toEqual(["android/assets/Bad_Image.png", "ios/App/App/Bad_Image.png"]);
		expect((yield* checks(namedAfterExport)).map((finding) => finding.file)).toEqual(["android/wrong-name.js", "ios/wrong-name.ts"]);
	},
);

ruleKit.it(
	"recognises catalogs, workspaces, Swift packages and qualified resources by their context",
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
	function* ({ checks }) {
		expect(yield* checks(folderNames)).toEqual([]);
		expect(yield* checks(otherNames)).toEqual([]);
	},
);

ruleKit.it(
	"checks names outside native conventions and code within native trees",
	[
		repositoryHas(
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
		),
	],
	function* ({ checks }) {
		expect((yield* checks(folderNames)).map((finding) => finding.file)).toEqual([
			"libraries/NativeKit/Sources/MyTarget/BadFolder",
			"mobile/src/main/res/BadFolder",
			"mobile/src/main/res/values-Night",
			"ordinary/BrandLogo.imageset",
			"ordinary/Sources",
			"ordinary/Sources/Target",
		]);
		expect((yield* checks(otherNames)).map((finding) => finding.file)).toEqual([
			"mobile/src/main/res/drawable/Bad_Image.png",
			"mobile/src/main/res/values/BadName.xml",
			"ordinary/BrandLogo.imageset/Bad_Image.png",
			"ordinary/Contents.json",
			"ordinary/res/mipmap-hdpi/ic_launcher.png",
			"ordinary/src/main/res/mipmap-hdpi/ic_launcher.png",
		]);
		expect((yield* checks(namedAfterExport)).map((finding) => finding.file)).toEqual([
			"desktop/Brand.xcassets/wrong-name.js",
			"mobile/src/main/res/raw/wrong-name.ts",
		]);
	},
);
