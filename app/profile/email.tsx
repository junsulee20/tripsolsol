import { Stack } from "expo-router";
import React, { useState } from "react";
import { useAuth } from "@hooks/useAuth";
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function EmailChangeScreen() {
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    const { user, updateEmail } = useAuth();

    const handleEmailChange = async () => {
        if (!newEmail || !password) {
            Alert.alert("오류", "모든 필드를 입력해주세요.");
            return;
        }

        try {
            await updateEmail(newEmail, password);
            Alert.alert("성공", "이메일이 성공적으로 변경되었습니다.");
            setNewEmail("");
            setPassword("");
        } catch (error) {
            Alert.alert("오류", "이메일 변경 중 문제가 발생했습니다.");
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "이메일 변경" }} />

            <View style={styles.form}>
                <Text style={styles.label}>현재 이메일</Text>
                <Text style={styles.currentEmail}>{user?.email}</Text>

                <Text style={styles.label}>새 이메일</Text>
                <TextInput
                    style={styles.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="새 이메일 주소"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="현재 비밀번호"
                    secureTextEntry
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
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#333",
    },
    currentEmail: {
        fontSize: 16,
        color: "#666",
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 8,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
