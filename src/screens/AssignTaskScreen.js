import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Staff-only screen. Categories config makes this route unreachable from
// the Categories grid for Technician and Pickup Person sessions.
export default function AssignTaskScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[18px] font-extrabold text-text">Assign Task</Text>
        <Text className="text-[13px] text-text-muted mt-2 text-center">
          Coming soon — assign incoming tickets to technicians and pickup persons.
        </Text>
      </View>
    </SafeAreaView>
  );
}
