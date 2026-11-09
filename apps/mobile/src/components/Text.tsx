import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, type as t } from '../theme';

type Variant = keyof typeof t;
interface Props extends TextProps { variant?: Variant; muted?: boolean; color?: string; weight?: TextStyle['fontWeight'] }

export function Text({ variant = 'body', muted, color, weight, style, ...rest }: Props) {
  return <RNText {...rest} style={[t[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, weight ? { fontWeight: weight } : null, style]} />;
}
