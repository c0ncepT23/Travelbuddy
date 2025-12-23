// Load .env file for local development
require('dotenv').config();

// Read sensitive values from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default {
  expo: {
    name: "Yori",
    slug: "travel-agent",
    version: "1.2.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    // TEMPORARILY DISABLED - expo-updates causes Windows build issues with SQLite
    // Re-enable after testing share feature
    // updates: {
    //   url: "https://u.expo.dev/03f5aa21-93d3-46d6-b572-f41aa2eee57a"
    // },
    // runtimeVersion: {
    //   policy: "appVersion"
    // },
    splash: {
      resizeMode: "contain",
      backgroundColor: "#0000FF"
    },
    platforms: ["ios", "android", "web"],
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Yori to use your location to notify you when you're near saved places.",
          locationAlwaysPermission: "Allow Yori to notify you about nearby saved places even when the app is closed.",
          locationWhenInUsePermission: "Allow Yori to use your location to suggest nearby saved places.",
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#6366F1"
        }
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: MAPBOX_ACCESS_TOKEN
        }
      ]
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.travelagent.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Yori needs your location to suggest nearby places from your saved list.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Yori needs your location to proactively suggest nearby places.",
        NSCameraUsageDescription: "Allow camera access to take photos of places you want to save.",
        NSPhotoLibraryUsageDescription: "Allow photo library access to upload images.",
        NSMicrophoneUsageDescription: "Allow microphone access for voice notes.",
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["travelagent"]
          }
        ],
        LSApplicationQueriesSchemes: ["youtube", "instagram", "reddit"]
      }
    },
    android: {
      package: "com.travelagent.app",
      // Use EAS secret for google-services.json during builds, fallback to local file for development
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./config/google-services.json",
      versionCode: 3,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECORD_AUDIO",
        "POST_NOTIFICATIONS",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ],
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#6366F1"
      },
      intentFilters: [
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [{ mimeType: "text/plain" }]
        },
        {
          action: "SEND",
          category: ["DEFAULT"],
          data: [{ mimeType: "text/*" }]
        },
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [{ scheme: "travelagent" }]
        },
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [{ scheme: "https", host: "*.youtube.com" }]
        },
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [{ scheme: "https", host: "youtu.be" }]
        },
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [{ scheme: "https", host: "*.instagram.com" }]
        }
      ]
    },
    extra: {
      eas: {
        projectId: "03f5aa21-93d3-46d6-b572-f41aa2eee57a"
      },
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      mapboxAccessToken: MAPBOX_ACCESS_TOKEN
    }
  }
};

