const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs"); // ✅ CommonJS 지원 추가
config.resolver.unstable_enablePackageExports = false; // ✅ Firebase Auth 이슈 해결용

module.exports = config;
