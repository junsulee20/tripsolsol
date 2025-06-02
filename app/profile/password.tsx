import { Stack } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function PasswordChangeScreen() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const { updatePassword } = useAuth();

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("오류", "모든 필드를 입력해주세요.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("오류", "새 비밀번호가 일치하지 않습니다.");
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert("오류", "비밀번호는 최소 6자 이상이어야 합니다.");
            return;
        }

        try {
            await updatePassword(currentPassword, newPassword);
            Alert.alert("성공", "비밀번호가 성공적으로 변경되었습니다.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            Alert.alert("오류", error.message || "비밀번호 변경 중 오류가 발생했습니다.");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "비밀번호 변경" }} />

            <View style={styles.form}>
                <Text style={styles.label}>현재 비밀번호</Text>
                <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="현재 비밀번호"
                    secureTextEntry
                />

                <Text style={styles.label}>새 비밀번호</Text>
                <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="새 비밀번호"
                    secureTextEntry
                />

                <Text style={styles.label}>새 비밀번호 확인</Text>
                <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="새 비밀번호 확인"
                    secureTextEntry
                />

                <TouchableOpacity
                    style={styles.button}
                    onPress={handlePasswordChange}
                >
                    <Text style={styles.buttonText}>비밀번호 변경</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        padding: 20,
    },
    form: {
        marginTop: 20,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 15,
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
    label: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#333",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
        backgroundColor: "#fff",
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 8,
        alignItems: "center",
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
