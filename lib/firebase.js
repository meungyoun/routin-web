import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAc7hlPD2_TLySlYdn9uYWoGAsHxlRQVl0",
    authDomain: "routine-app-67b49.firebaseapp.com",
    projectId: "routine-app-67b49",
    storageBucket: "routine-app-67b49.firebasestorage.app",
    messagingSenderId: "1019519210572",
    appId: "1:1019519210572:web:15a1bc6f188d3d24dc90e9"
};

// 파이어베이스 시작
const app = initializeApp(firebaseConfig);

// DB(창고) 열기
const db = getFirestore(app);

// ⭐⭐⭐ 이 줄이 없으면 'db is not defined' 에러가 납니다! ⭐⭐⭐
export { db };