import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { UnreadProvider } from '../auth/UnreadContext';
import { ErrorState, Loading } from '../components';
import { colors } from '../theme';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import MainTabs from './MainTabs';
import type { AuthStackParamList, RootStackParamList } from './types';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
};

const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();

const headerOptions = {
  headerTintColor: colors.accent,
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text, fontWeight: '600' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

export default function RootNavigator() {
  const { status, bootError, retryBoot } = useAuth();

  if (status === 'loading') return <View style={styles.center}><Loading /></View>;
  if (status === 'unreachable') {
    return <View style={styles.center}><ErrorState message={bootError ?? 'Could not reach the server.'} onRetry={retryBoot} /></View>;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {status === 'signedIn' ? (
        <UnreadProvider>
          <Root.Navigator screenOptions={headerOptions}>
            <Root.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Root.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense' }} />
            <Root.Screen name="ExpenseForm" component={ExpenseFormScreen} options={({ route }) => ({ title: route.params?.id ? 'Edit expense' : 'New expense' })} />
            <Root.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Card transactions' }} />
            <Root.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change password' }} />
          </Root.Navigator>
        </UnreadProvider>
      ) : (
        <Auth.Navigator screenOptions={{ ...headerOptions, headerShown: false }}>
          <Auth.Screen name="Login" component={LoginScreen} />
          <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Reset password' }} />
        </Auth.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg } });
