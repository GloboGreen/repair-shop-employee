import React from 'react';
import { Text, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { cn } from './cn';
import { Button } from './Button';

export function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <View className={cn('items-center justify-center px-8 py-12', className)}>
      <View className="h-20 w-20 rounded-full bg-primary/10 items-center justify-center mb-4">
        {icon || <Inbox size={32} color="#00008B" />}
      </View>
      <Text className="text-[16px] font-extrabold text-text text-center">{title}</Text>
      {description ? (
        <Text className="text-[13px] text-text-muted text-center mt-1">{description}</Text>
      ) : null}
      {actionLabel ? (
        <Button onPress={onAction} className="mt-5">{actionLabel}</Button>
      ) : null}
    </View>
  );
}
