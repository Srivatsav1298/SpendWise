import React from 'react';
import type { TextProps } from 'react-native';
import { formatMoney } from '../lib/money';
import { useAuth } from '../auth/AuthContext';
import { Text } from './Text';

interface Props extends TextProps {
  value: string | null | undefined;
  currency?: string;
  variant?: React.ComponentProps<typeof Text>['variant'];
  color?: string;
  muted?: boolean;
}

/** Display-only money text. Uses the org currency unless one is given (e.g. the expense's own currency). */
export function Money({ value, currency, variant = 'body', ...rest }: Props) {
  const auth = useAuth();
  return <Text variant={variant} weight="600" {...rest}>{formatMoney(value, currency ?? auth.currency)}</Text>;
}
