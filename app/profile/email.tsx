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

export default function EmailChangeScreen() {
    const [newEmail, setNewEmail] = useState("");
    const [confirmEmail, setConfirmEmail] = useState("");
    const { updateEmail } = useAuth();

    const handleEmailChange = async () => {
        if (!newEmail || !confirmEmail) {
            Alert.alert("오류", "모든 필드를 입력해주세요.");
            return;
        }

        if (newEmail !== confirmEmail) {
            Alert.alert("오류", "이메일이 일치하지 않습니다.");
            return;
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            Alert.alert("오류", "유효한 이메일 주소를 입력해주세요.");
            return;
        }

        try {
            await updateEmail(newEmail);
            setNewEmail("");
            setConfirmEmail("");
        } catch (error: any) {
            Alert.alert("오류", error.message || "이메일 변경 중 오류가 발생했습니다.");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "이메일 변경" }} />

            <View style={styles.form}>
                <Text style={styles.label}>새 이메일</Text>
                <TextInput
                    style={styles.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="새 이메일 주소"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                />

                <Text style={styles.label}>이메일 확인</Text>
                <TextInput
                    style={styles.input}
                    value={confirmEmail}
                    onChangeText={setConfirmEmail}
                    placeholder="이메일 주소 확인"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                />

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleEmailChange}
                >
                    <Text style={styles.buttonText}>이메일 변경</Text>
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
