const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs"); // ✅ CommonJS 지원 추가
config.resolver.unstable_enablePackageExports = false; // ✅ Firebase Auth 이슈 해결용

// ✅ expo-camera web 호환성 해결
config.resolver.alias = {
  ...config.resolver.alias,
  // expo-camera 웹 지원 fallback
  'expo-camera/build/web/WebUserMediaManager': 'expo-camera/build/Camera.web.js',
};

module.exports = config;
