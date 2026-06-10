import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AttendanceTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[20px] font-extrabold text-text">Attendance</Text>
        <Text className="text-[13px] text-text-muted mt-2 text-center">
          Tap a date to view your check-in/check-out history.
        </Text>
      </View>
    </SafeAreaView>
  );
}
