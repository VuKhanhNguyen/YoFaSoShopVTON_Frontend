const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const MEDIAPIPE_DEP = 'implementation("com.google.mediapipe:tasks-vision:1.2.3")';

function withHandGestureCamera(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const hasCam = manifest["uses-permission"].some(
      (p) => p.$ && p.$["android:name"] === "android.permission.CAMERA"
    );
    if (!hasCam) {
      manifest["uses-permission"].unshift({
        $: { "android:name": "android.permission.CAMERA" },
      });
    }
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    let src = mod.modResults.contents;
    if (!src.includes("com.google.mediapipe:tasks-vision")) {
      src = src.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")\n    ${MEDIAPIPE_DEP}`
      );
    }
    if (!src.includes('noCompress += ["task"]')) {
      src = src.replace(
        "androidResources {",
        'androidResources {\n        noCompress += ["task"]'
      );
    }
    mod.modResults.contents = src;
    return mod;
  });

  config = withProjectBuildGradle(config, (mod) => {
    let src = mod.modResults.contents;
    if (!src.includes("yfs-cxx")) {
      src += `\n// shortcut: keep CMake .cxx paths under Windows MAX_PATH (260 chars) for native modules; remove if repo path is shortened\nif (System.getProperty("os.name").toLowerCase().contains("windows")) {\n  subprojects { sub ->\n    sub.plugins.withId("com.android.library") {\n      def components = sub.extensions.findByName("androidComponents")\n      if (components != null) {\n        components.finalizeDsl { ext ->\n          if (ext.externalNativeBuild?.cmake?.path != null) {\n            ext.externalNativeBuild.cmake.buildStagingDirectory = new File(rootDir.toPath().root.toFile(), "yfs-cxx/\${sub.name}")\n            ext.defaultConfig.externalNativeBuild.cmake.arguments.add("-DCMAKE_OBJECT_PATH_MAX=220")\n          }\n        }\n      }\n    }\n  }\n}\n`;
    }
    mod.modResults.contents = src;
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    let src = mod.modResults.contents;
    if (!src.includes("com.yofaso.shop.mediapipe.HandGesturePackage")) {
      src = src.replace(
        "import expo.modules.ExpoReactHostFactory",
        "import expo.modules.ExpoReactHostFactory\nimport com.yofaso.shop.mediapipe.HandGesturePackage"
      );
    }
    if (!src.includes("add(HandGesturePackage())")) {
      src = src.replace(
        "PackageList(this).packages.apply {",
        "PackageList(this).packages.apply {\n          add(HandGesturePackage())"
      );
    }
    mod.modResults.contents = src;
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const androidRoot = mod.modRequest.platformProjectRoot;

      const modelSrc = path.join(projectRoot, "assets", "mediapipe", "gesture_recognizer.task");
      const assetsDir = path.join(androidRoot, "app", "src", "main", "assets");
      if (fs.existsSync(modelSrc)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.copyFileSync(modelSrc, path.join(assetsDir, "gesture_recognizer.task"));
      }

      const ktSrcDir = path.join(projectRoot, "plugins", "android-mediapipe");
      const ktDstDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "yofaso",
        "shop",
        "mediapipe"
      );
      if (fs.existsSync(ktSrcDir)) {
        fs.mkdirSync(ktDstDir, { recursive: true });
        for (const file of fs.readdirSync(ktSrcDir)) {
          if (file.endsWith(".kt")) {
            fs.copyFileSync(path.join(ktSrcDir, file), path.join(ktDstDir, file));
          }
        }
      }
      return mod;
    },
  ]);

  return config;
}

module.exports = withHandGestureCamera;
