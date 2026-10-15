import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { initDatabase } from "./src/db/database";
import { ChangePasswordScreen } from "./src/screens/ChangePasswordScreen";
import { BatchesScreen } from "./src/screens/BatchesScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { FarmerDetailScreen } from "./src/screens/FarmerDetailScreen";
import { FarmerHomeScreen } from "./src/screens/FarmerHomeScreen";
import { FarmerListScreen } from "./src/screens/FarmerListScreen";
import { FarmerLoginScreen } from "./src/screens/FarmerLoginScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OutboxScreen } from "./src/screens/OutboxScreen";
import { RecordReceiptScreen } from "./src/screens/RecordReceiptScreen";
import { StaffScreen } from "./src/screens/StaffScreen";
import type { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { session, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#1d4d36" },
        headerTintColor: "white",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f6f2ea" },
      }}
    >
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="FarmerLogin" component={FarmerLoginScreen} />
        </>
      ) : session.kind === "farmer" ? (
        <Stack.Screen name="FarmerHome" component={FarmerHomeScreen} />
      ) : (
        <>
          <Stack.Screen name="FarmerList" component={FarmerListScreen} />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ headerShown: true, title: "Dashboard" }}
          />
          <Stack.Screen
            name="Batches"
            component={BatchesScreen}
            options={{ headerShown: true, title: "Batches & prices" }}
          />
          <Stack.Screen
            name="Staff"
            component={StaffScreen}
            options={{ headerShown: true, title: "Staff" }}
          />
          <Stack.Screen
            name="Outbox"
            component={OutboxScreen}
            options={{ headerShown: true, title: "Waiting to send" }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ headerShown: true, title: "My Account" }}
          />
          <Stack.Screen
            name="FarmerDetail"
            component={FarmerDetailScreen}
            options={{ headerShown: true, title: "Farmer" }}
          />
          <Stack.Screen
            name="RecordReceipt"
            component={RecordReceiptScreen}
            options={{ headerShown: true, title: "Record Receipt" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase();
    setDbReady(true);
  }, []);

  if (!dbReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
