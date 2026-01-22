import type { FontWeight, TextPreset } from './types';

export interface TextPresetConfig {
  fontSize: number;
  fontWeight: FontWeight;
  lineHeight: number;
  label: string;
}

export const TEXT_PRESETS: Record<TextPreset, TextPresetConfig> = {
  heading1: { fontSize: 32, fontWeight: 'bold', lineHeight: 1.2, label: 'Heading 1' },
  heading2: { fontSize: 24, fontWeight: 'bold', lineHeight: 1.25, label: 'Heading 2' },
  heading3: { fontSize: 20, fontWeight: 'bold', lineHeight: 1.3, label: 'Heading 3' },
  body: { fontSize: 16, fontWeight: 'normal', lineHeight: 1.5, label: 'Body' },
  label: { fontSize: 14, fontWeight: 'normal', lineHeight: 1.4, label: 'Label' },
  caption: { fontSize: 12, fontWeight: 'normal', lineHeight: 1.4, label: 'Caption' },
};

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 32, 40, 48];

export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.5;
