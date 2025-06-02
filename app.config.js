// app.config.js
import "dotenv/config"; // .env 파일에서 값을 읽고 싶다면
export default {
    expo: {
        name: "TripSolSol",
        slug: "TripSolSol",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "tripsolsol",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        assetBundlePatterns: [
            "**/*"
        ],

        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.team5.tripsolsol",
            googleServicesFile: "./ios/TripSolSol/GoogleService-Info.plist",
            infoPlist: {
                NSPhotoLibraryUsageDescription:
                    "프로필 이미지를 선택하기 위해 사진 라이브러리 접근 권한이 필요합니다.",
                NSCameraUsageDescription:
                    "프로필 이미지를 촬영하기 위해 카메라 접근 권한이 필요합니다.",
            },
            buildNumber: "1.0.0"
        },

        android: {
            package: "com.team5.tripsolsol",
            edgeToEdgeEnabled: true,
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#ffffff",
            },
            googleServicesFile: "./android/app/google-services.json",
            permissions: [
                "CAMERA",
                "READ_EXTERNAL_STORAGE",
                "WRITE_EXTERNAL_STORAGE",
            ],
            versionCode: 1
        },

        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png",
        },

        plugins: [
            "expo-router",
            [
                "expo-splash-screen",
                {
                    image: "./assets/images/splash-icon.png",
                    imageWidth: 200,
                    resizeMode: "contain",
                    backgroundColor: "#ffffff",
                },
            ],
            [
                "expo-image-picker",
                {
                    photosPermission:
                        "프로필 이미지를 선택하기 위해 사진 라이브러리 접근 권한이 필요합니다.",
                    cameraPermission:
                        "프로필 이미지를 촬영하기 위해 카메라 접근 권한이 필요합니다.",
                },
            ],
        ],

        experiments: { typedRoutes: true },

        /** 🔴 extra는 **한 번**만! */
        extra: {
            eas: { projectId: "05d3b651-987d-43df-b1af-2f6ae149297d" },
            firebaseConfig: {
                apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId:
                    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
                measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
            },
        },
    },
};
