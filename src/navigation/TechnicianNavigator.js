import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import colors from '../theme/colors';
import BackButton from '../components/BackButton';
import { LogoutContext } from '../auth/LogoutContext';

// Tab roots (have their own bottom tab bar — header hidden)
import HomeScreen from '../screens/HomeScreen';
import AttendanceTabScreen from '../screens/AttendanceTabScreen';
import TasksTabScreen from '../screens/TasksTabScreen';
import AccountTabScreen from '../screens/AccountTabScreen';

// Category drill-down screens
import DailyAttendanceScreen from '../screens/DailyAttendanceScreen';
import DailyShiftScheduleScreen from '../screens/DailyShiftScheduleScreen';
import MonthlySummaryScreen from '../screens/MonthlySummaryScreen';
import LeaveReportScreen from '../screens/LeaveReportScreen';
import AssignTaskScreen from '../screens/AssignTaskScreen';
import SalaryReportScreen from '../screens/SalaryReportScreen';

// Existing technician workflow screens (reused from the original flow)
import TechnicianProfileScreen from '../screens/TechnicianProfileScreen';
import TechnicianDashboardScreen from '../screens/TechnicianDashboardScreen';
import AssignedTicketsScreen from '../screens/AssignedTicketsScreen';
import TechnicianTicketDetailScreen from '../screens/TechnicianTicketDetailScreen';
import UpdateStatusScreen from '../screens/UpdateStatusScreen';
import AddRepairNotesScreen from '../screens/AddRepairNotesScreen';
import UploadRepairImagesScreen from '../screens/UploadRepairImagesScreen';
import TechnicianApplyLeaveScreen from '../screens/TechnicianApplyLeaveScreen';
import SolutionPackUploadScreen from '../screens/SolutionPackUploadScreen';
import SolutionPackReferenceViewScreen from '../screens/SolutionPackReferenceViewScreen';

const Stack = createNativeStackNavigator();

export default function TechnicianNavigator({ session, onLogout }) {
  return (
    <LogoutContext.Provider value={onLogout}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={({ navigation }) => ({
          headerStyle: { backgroundColor: colors.headerBg },
          headerShadowVisible: true,
          headerTintColor: colors.headerText,
          headerTitleStyle: { fontSize: 17, fontWeight: '700', color: colors.headerText },
          headerTitleAlign: 'center',
          headerTitleAllowFontScaling: false,
          headerLeft: () => {
            if (!navigation.canGoBack()) return null;
            return <BackButton onPress={() => navigation.goBack()} />;
          },
          headerBackVisible: false,
        })}
      >
        {/* Tab roots — their own custom bottom bar, no native header */}
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AttendanceTab" component={AttendanceTabScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TasksTab" component={TasksTabScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AccountTab" component={AccountTabScreen} options={{ headerShown: false }} />

        {/* Category drill-downs */}
        <Stack.Screen name="DailyAttendance" component={DailyAttendanceScreen} options={{ title: 'Daily Attendance' }} />
        <Stack.Screen name="DailyShiftSchedule" component={DailyShiftScheduleScreen} options={{ title: 'Daily Shift Schedule' }} />
        <Stack.Screen name="MonthlySummary" component={MonthlySummaryScreen} options={{ title: 'Monthly Summary' }} />
        <Stack.Screen name="LeaveReport" component={LeaveReportScreen} options={{ title: 'Leave Report' }} />
        <Stack.Screen name="AssignTask" component={AssignTaskScreen} options={{ title: 'Assign Task' }} />
        <Stack.Screen name="SalaryReport" component={SalaryReportScreen} options={{ title: 'Salary Report' }} />

        {/* Existing technician workflow */}
        <Stack.Screen name="TechnicianProfile" component={TechnicianProfileScreen} options={{ title: 'My Profile' }} />
        <Stack.Screen name="TechnicianDashboard" component={TechnicianDashboardScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="AssignedTickets" component={AssignedTicketsScreen} options={{ title: 'Assign Task List' }} />
        <Stack.Screen name="TechnicianTicketDetail" component={TechnicianTicketDetailScreen} options={{ title: 'Ticket Detail' }} />
        <Stack.Screen name="UpdateStatus" component={UpdateStatusScreen} options={{ title: 'Update Status' }} />
        <Stack.Screen name="AddRepairNotes" component={AddRepairNotesScreen} options={{ title: 'Add Note' }} />
        <Stack.Screen name="UploadRepairImages" component={UploadRepairImagesScreen} options={{ title: 'Upload Images' }} />
        <Stack.Screen name="TechnicianApplyLeave" component={TechnicianApplyLeaveScreen} options={{ title: 'Apply for leave' }} />
        <Stack.Screen name="SolutionPackUpload" component={SolutionPackUploadScreen} options={{ title: 'New Issue Solution Pack Upload' }} />
        <Stack.Screen name="SolutionPackReferenceView" component={SolutionPackReferenceViewScreen} options={{ title: 'Issue Reference Solution Pack View' }} />
      </Stack.Navigator>
    </LogoutContext.Provider>
  );
}
