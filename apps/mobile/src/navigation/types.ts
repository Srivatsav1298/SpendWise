import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Expenses: undefined;
  Limits: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ExpenseDetail: { id: string };
  ExpenseForm: { id?: string } | undefined;
  Transactions: undefined;
  ChangePassword: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
