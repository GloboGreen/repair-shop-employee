import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomTabBar from '../components/BottomTabBar';

export default function TasksTabScreen({ navigation }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[20px] font-extrabold text-text">Tasks</Text>
        <Text className="text-[13px] text-text-muted mt-2 text-center">
          Jump straight into your assigned tickets.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('AssignedTickets')}
          className="mt-4 bg-primary rounded-xl px-6 py-3"
        >
          <Text className="text-white font-bold">Open My Tickets</Text>
        </Pressable>
      </View>
      <BottomTabBar active="Tasks" navigation={navigation} />
    </SafeAreaView>
  );
}
