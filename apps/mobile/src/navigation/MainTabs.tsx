import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useUnread } from '../auth/UnreadContext';
import { colors } from '../theme';
import ExpensesScreen from '../screens/ExpensesScreen';
import HomeScreen from '../screens/HomeScreen';
import LimitsScreen from '../screens/LimitsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
type IconName = keyof typeof Ionicons.glyphMap;
const icons: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ['home', 'home-outline'],
  Expenses: ['receipt', 'receipt-outline'],
  Limits: ['card', 'card-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Profile: ['person', 'person-outline'],
};

export default function MainTabs() {
  const { unread } = useUnread();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={icons[route.name][focused ? 0 : 1]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Limits" component={LimitsScreen} options={{ title: 'Cards' }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.accentText },
          tabBarAccessibilityLabel: unread > 0 ? `Notifications, ${unread} unread` : 'Notifications',
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
