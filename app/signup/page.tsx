'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("buyer");
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Firebase Auth로 회원가입
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Firestore에 사용자 정보 및 역할 저장
            await setDoc(doc(collection(db, "users"), user.uid), {
                email,
                role,
                createdAt: new Date()
            });

            alert("회원가입 완료! 로그인 페이지로 이동합니다.");
            router.push("/login");

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">회원가입</h1>
            <form onSubmit={handleSignup} className="flex flex-col space-y-4 w-full max-w-sm">
                <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border p-2 rounded"
                />
                <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border p-2 rounded"
                />
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="border p-2 rounded"
                >
                    <option value="buyer">구매자</option>
                    <option value="seller">판매자</option>
                    <option value="admin">관리자</option>
                </select>
                <button
                    type="submit"
                    className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                >
                    회원가입
                </button>
            </form>
        </div>
    );
}
