import React from 'react';
import { View, Text } from 'react-native';
import { cn } from './cn';

const variantClasses = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  error: 'bg-danger',
  muted: 'bg-border',
  softSuccess: 'bg-success/10',
  softDanger: 'bg-danger/10',
  softWarning: 'bg-warning/10',
  softPrimary: 'bg-primary/10',
  softSecondary: 'bg-secondary/10',
};

const textVariantClasses = {
  default: 'text-white',
  secondary: 'text-white',
  success: 'text-white',
  warning: 'text-white',
  danger: 'text-white',
  error: 'text-white',
  muted: 'text-text',
  softSuccess: 'text-success',
  softDanger: 'text-danger',
  softWarning: 'text-warning',
  softPrimary: 'text-primary',
  softSecondary: 'text-secondary',
};

export function Badge({ variant = 'default', className, textClassName, leftIcon, children }) {
  return (
    <View className={cn('px-2.5 py-1 rounded-full self-start flex-row items-center', variantClasses[variant], className)}>
      {leftIcon ? <View className="mr-1">{leftIcon}</View> : null}
      <Text className={cn('text-[11px] font-bold tracking-wide', textVariantClasses[variant], textClassName)}>{children}</Text>
    </View>
  );
}
