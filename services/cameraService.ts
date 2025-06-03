import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Platform-specific camera imports
let CameraView: any = null;
let CameraType: any = null;
let useCameraPermissions: any = null;

if (Platform.OS !== 'web') {
  try {
    const expoCameraModule = require('expo-camera');
    CameraView = expoCameraModule.CameraView;
    CameraType = expoCameraModule.CameraType;
    useCameraPermissions = expoCameraModule.useCameraPermissions;
  } catch (error) {
    console.warn('expo-camera not available:', error);
  }
}

export interface CameraPermission {
  granted: boolean;
  status?: string;
}

export interface CameraHooks {
  permission: CameraPermission | null;
  requestPermission: () => Promise<CameraPermission>;
}

export const useCameraPermissionsWrapper = (): CameraHooks => {
  if (Platform.OS === 'web') {
    return {
      permission: { granted: false },
      requestPermission: async () => ({ granted: false })
    };
  }

  if (useCameraPermissions) {
    return useCameraPermissions();
  }

  return {
    permission: { granted: false },
    requestPermission: async () => ({ granted: false })
  };
};

export const takePicture = async (cameraRef: any, options: any) => {
  if (Platform.OS === 'web') {
    throw new Error('Camera not supported on web');
  }

  if (!cameraRef.current) {
    throw new Error('Camera ref not available');
  }

  return await cameraRef.current.takePictureAsync(options);
};

export const pickFromGallery = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Gallery permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error('No image selected');
  }

  return result.assets[0].uri;
};

export { CameraView, CameraType };
export const isWebPlatform = Platform.OS === 'web'; 