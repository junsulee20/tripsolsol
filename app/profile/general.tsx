import { Stack } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function GeneralSettingsScreen() {
    const { userData, updateUserSettings } = useAuth();
    const [notifications, setNotifications] = useState(
        userData?.settings?.notifications?.email ?? true
    );
    const [darkMode, setDarkMode] = useState(userData?.settings?.darkMode ?? false);
    const [locationServices, setLocationServices] = useState(
        userData?.settings?.locationServices ?? true
    );

    const handleSaveSettings = async () => {
        try {
            await updateUserSettings({
                notifications: {
                    email: notifications,
                    push: notifications,
                    tripUpdates: notifications,
                    expenseUpdates: notifications,
                    settlementUpdates: notifications
                },
                darkMode,
                locationServices,
            });
            Alert.alert("성공", "설정이 저장되었습니다.");
        } catch (error) {
            Alert.alert("오류", "설정 저장 중 문제가 발생했습니다.");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "일반 설정" }} />

            <View style={styles.section}>
                <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>알림</Text>
                        <Text style={styles.settingDescription}>
                            앱 알림을 받습니다
                        </Text>
                    </View>
                    <Switch
                        value={notifications}
                        onValueChange={setNotifications}
                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                        thumbColor={notifications ? "#007AFF" : "#f4f3f4"}
                    />
                </View>

                <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>다크 모드</Text>
                        <Text style={styles.settingDescription}>
                            어두운 테마를 사용합니다
                        </Text>
                    </View>
                    <Switch
                        value={darkMode}
                        onValueChange={setDarkMode}
                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                        thumbColor={darkMode ? "#007AFF" : "#f4f3f4"}
                    />
                </View>

                <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>위치 서비스</Text>
                        <Text style={styles.settingDescription}>
                            위치 기반 서비스를 사용합니다
                        </Text>
                    </View>
                    <Switch
                        value={locationServices}
                        onValueChange={setLocationServices}
                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                        thumbColor={locationServices ? "#007AFF" : "#f4f3f4"}
                    />
                </View>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleSaveSettings}
            >
                <Text style={styles.buttonText}>설정 저장</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        padding: 20,
    },
    section: {
        marginTop: 20,
        backgroundColor: "#fff",
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.1,
                shadowRadius: 3,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    settingItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    settingInfo: {
        flex: 1,
        marginRight: 10,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: "#666",
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 30,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.2,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
