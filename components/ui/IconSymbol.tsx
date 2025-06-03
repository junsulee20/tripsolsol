// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolView, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, Platform, type StyleProp, type TextStyle, ViewStyle } from 'react-native';

// Note: This mapping is only for when MaterialIcons are used (Android/web fallback)
type IconMapping = Record<string, string | undefined>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'doc.fill': 'description',
  'plus.circle.fill': 'add-circle',
  'person.fill': 'settings',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  if (Platform.OS === 'ios') {
    // Use SF Symbols on iOS
    return (
      <SymbolView
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
        name={name}
        style={[
          {
            width: size,
            height: size,
          },
          style,
        ]}
      />
    );
  } else {
    // Use MaterialIcons on Android and web as a fallback
    // Find the Material Icon name from the mapping, or use a default/fallback if not found
    const materialIconName = MAPPING[name];

    // If a mapping exists, use it. Otherwise, use a generic fallback icon.
    const finalMaterialIconName = materialIconName || 'help';

    // MaterialIcons uses TextStyle, so apply style with appropriate type assertion
    return <MaterialIcons color={color} size={size} name={finalMaterialIconName as any} style={style as StyleProp<TextStyle>} />;
  }
}
