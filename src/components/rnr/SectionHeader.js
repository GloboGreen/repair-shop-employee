import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cn } from './cn';

export function SectionHeader({ title, action, onAction, className, caption }) {
  return (
    <View className={cn('flex-row items-end justify-between px-4 mt-3.5 mb-2', className)}>
      <View className="flex-1 pr-3">
        <Text className="text-[14px] font-extrabold text-text">{title}</Text>
        {caption ? (
          <Text className="text-[10px] text-text-muted mt-0.5">{caption}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} className="flex-row items-center active:opacity-70">
          <Text className="text-[11px] font-bold text-primary">{action}</Text>
          <ChevronRight size={12} color="#00008B" />
        </Pressable>
      ) : null}
    </View>
  );
}
