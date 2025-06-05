declare module 'expo-barcode-generator' {
  interface GenerateOptions {
    type: 'qr' | 'code128' | 'code39' | 'ean13' | 'ean8' | 'upc';
    width: number;
    height: number;
    backgroundColor?: string;
    color?: string;
    margin?: number;
  }

  interface GenerateResult {
    uri: string;
  }

  export function generateAsync(
    data: string,
    options: GenerateOptions
  ): Promise<GenerateResult>;
} 