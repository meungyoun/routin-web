"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc, 
  setDoc 
} from "firebase/firestore";

// 날짜 계산 (새벽 4시 리셋)
const getGodsaengDate = () => {
  const now = new Date();
  if (now.getHours() < 4) now.setDate(now.getDate() - 1);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function Home() {
  // 사용자 정보
  const [myName, setMyName] = useState(""); 
  const [myAvatar, setMyAvatar] = useState("😎"); // 기본 프사
  const [isMyPageOpen, setIsMyPageOpen] = useState(false); // 마이페이지 열림 여부

  // 로그인/입장용 임시 변수
  const [tempName, setTempName] = useState("");
  const [tempPw, setTempPw] = useState("");
  
  // 계획 입력 변수
  const [time, setTime] = useState("");
  const [todo, setTodo] = useState("");
  const [todos, setTodos] = useState<any[]>([]);
  const [usersInfo, setUsersInfo] = useState<any>({}); // 친구들 프사 정보 저장소

  const todayDate = getGodsaengDate();

  // 1. 계획 데이터 실시간 감시
  useEffect(() => {
    const q = query(collection(db, "plans"), where("date", "==", todayDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      newTodos.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setTodos(newTodos); 
    });
    return () => unsubscribe();
  }, [todayDate]);

  // 2. 유저 정보(프사 등) 실시간 감시 (새로운 기능! ⭐)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const info: any = {};
      snapshot.docs.forEach(doc => {
        info[doc.id] = doc.data(); // { "승연": { avatar: "🐰", ... }, ... }
      });
      setUsersInfo(info);
      
      // 내 정보가 업데이트되면 바로 반영
      if (myName && info[myName]) {
        setMyAvatar(info[myName].avatar || "😎");
      }
    });
    return () => unsubscribe();
  }, [myName]);

  // 입장/로그인
  const enterApp = async () => {
    if (!tempName.trim() || !tempPw.trim()) return alert("입력해주세요.");
    try {
      const userRef = doc(db, "users", tempName);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        if (userSnap.data().password === tempPw) {
          alert(`'${tempName}'님 좋은 하루 되세염!`);
          setMyName(tempName);
          setMyAvatar(userSnap.data().avatar || "😎");
        } else {
          alert("비밀번호가 틀렸습니다.");
        }
      } else {
        if (confirm(`'${tempName}' 님 안녕!! 계정을 만들게요`)) {
          await setDoc(userRef, { 
            password: tempPw, 
            avatar: "👶", // 신규 유저는 응애 아이콘
            createdAt: new Date() 
          });
          alert("가입 완료!");
          setMyName(tempName);
          setMyAvatar("👶");
        }
      }
    } catch (e) {
      console.error(e);
      alert("에러 발생. 뽀삐한테 알려주세요...");
    }
  };

  // 계획 추가
  const addPlan = async () => {
    if (!todo.trim() || !time.trim()) return;
    await addDoc(collection(db, "plans"), {
      name: myName,
      time,
      task: todo,
      isDone: false,
      date: todayDate,
      createdAt: new Date() 
    });
    setTodo(""); 
  };

  const toggleDone = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "plans", id), { isDone: !currentStatus });
  };
  
  const deletePlan = async (id: string) => {
    if (confirm("계획을 삭제합니다.")) await deleteDoc(doc(db, "plans", id));
  };

  // --- 마이페이지 기능들 ---
  const updateProfile = async (newAvatar: string, newPw: string) => {
    if (!newPw.trim()) return alert("비밀번호는 비울 수 없습니다.");
    try {
      await updateDoc(doc(db, "users", myName), {
        avatar: newAvatar,
        password: newPw
      });
      alert("프로필 변경 완료!");
      setIsMyPageOpen(false); // 창 닫기
    } catch (e) {
      alert("저장 실패");
    }
  };

  // -----------------------

  // 1. 로그인 전 화면
  if (myName === "") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-4xl font-bold mb-4">^^@</h1>
        <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-sm text-center border border-gray-700">
          <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="닉네임" className="w-full p-3 mb-3 rounded bg-gray-700 text-white outline-none"/>
          <input type="password" value={tempPw} onChange={(e) => setTempPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enterApp()} placeholder="비밀번호" className="w-full p-3 mb-6 rounded bg-gray-700 text-white outline-none"/>
          <button onClick={enterApp} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded">입장하기</button>
        </div>
      </div>
    );
  }

  // 2. 메인 화면
  const users = Array.from(new Set(todos.map(t => t.name)));
  if (!users.includes(myName)) users.unshift(myName);
  users.sort((a, b) => (a === myName ? -1 : b === myName ? 1 : 0));

  return (
    <div className="min-h-screen bg-gray-900 p-4 text-white pb-20">
      {/* 상단바 */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 px-2">
        <h1 className="text-xl font-bold text-gray-300">📅 {todayDate}</h1>
        <div className="flex gap-3">
          <button onClick={() => setIsMyPageOpen(true)} className="bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600">
            ⚙️ 마이페이지
          </button>
          <button onClick={() => setMyName("")} className="text-sm text-gray-500 underline">로그아웃</button>
        </div>
      </div>

      {/* 계획 입력 */}
      <div className="max-w-4xl mx-auto bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-2 items-center sticky top-0 z-10 shadow-lg border border-gray-700">
        <span className="font-bold text-yellow-400 shrink-0 flex items-center gap-2">
          <span className="text-2xl">{myAvatar}</span> {myName}
        </span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-gray-700 text-white p-2 rounded outline-none"/>
        <input type="text" value={todo} onChange={(e) => setTodo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlan()} placeholder="오늘의 계획" className="bg-gray-700 text-white p-2 rounded flex-1 outline-none w-full"/>
        <button onClick={addPlan} className="bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-500 w-full md:w-auto">추가</button>
      </div>

      {/* 상황판 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {users.map((user) => (
          <div key={user} className={`rounded-xl p-4 border-2 min-h-[300px] ${user === myName ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50'}`}>
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center border-b border-gray-600 pb-2">
              <div className="flex items-center gap-2">
                 {/* 친구 프사 보여주기 */}
                <span className="text-2xl">{usersInfo[user]?.avatar || "😎"}</span>
                {user} {user === myName && " (나)"}
              </div>
              <span className="text-xs font-normal bg-gray-700 px-2 py-1 rounded">
                {Math.round((todos.filter(t => t.name === user && t.isDone).length / (todos.filter(t => t.name === user).length || 1)) * 100)}%
              </span>
            </h2>
            <ul className="space-y-2">
              {todos.filter(t => t.name === user).map((plan) => (
                <li key={plan.id} className="flex items-center gap-2 bg-gray-700/50 p-2 rounded hover:bg-gray-700 transition">
                  <input type="checkbox" checked={plan.isDone} disabled={user !== myName} onChange={() => toggleDone(plan.id, plan.isDone)} className={`w-5 h-5 accent-green-500 ${user !== myName ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}/>
                  <span className={`text-sm font-mono text-gray-400`}>{plan.time}</span>
                  <span className={`flex-1 ${plan.isDone ? 'text-gray-500 line-through' : 'text-white'}`}>{plan.task}</span>
                  {user === myName && (<button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 px-2">×</button>)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ⭐ 마이페이지 모달 (팝업) ⭐ */}
      {isMyPageOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md border border-gray-600 relative">
            <button onClick={() => setIsMyPageOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
            <h2 className="text-2xl font-bold mb-6 text-center">⚙️ 내 정보 수정</h2>
            
            <div className="mb-6">
              <label className="block text-gray-400 mb-2">프로필 아이콘 (이모지)</label>
              <div className="grid grid-cols-5 gap-2">
                {["😎", "🐰", "🐱", "🐶", "🦊", "🐻", "🐼", "🐯", "🦁", "🐮", "🐷", "🐸", "👻", "👽", "🐎"].map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => setMyAvatar(emoji)}
                    className={`text-2xl p-2 rounded ${myAvatar === emoji ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-400 mb-2">비밀번호 변경</label>
              <input 
                type="password" 
                placeholder="새로운 비밀번호" 
                id="newPwInput"
                className="w-full p-3 rounded bg-gray-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button 
              onClick={() => {
                const newPw = (document.getElementById("newPwInput") as HTMLInputElement).value;
                updateProfile(myAvatar, newPw || tempPw); // 비번 안 바꿨으면 기존 비번 유지해야 하는데, 여기선 간단히 구현
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded"
            >
              저장하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}