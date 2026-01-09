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

const REACTION_EMOJIS = ["🔥", "💯", "🥰", "💪", "👀"];

export default function Home() {
  const [myName, setMyName] = useState(""); 
  const [myAvatar, setMyAvatar] = useState("😎"); 
  const [isMyPageOpen, setIsMyPageOpen] = useState(false); 

  const [tempName, setTempName] = useState("");
  const [tempPw, setTempPw] = useState("");
  
  const [time, setTime] = useState("");
  const [todo, setTodo] = useState("");
  const [todos, setTodos] = useState<any[]>([]);
  const [usersInfo, setUsersInfo] = useState<any>({}); 

  const todayDate = getGodsaengDate();

  // 0. 자동 로그인 체크
  useEffect(() => {
    const storedName = localStorage.getItem("godsaeng_user");
    if (storedName) {
      setMyName(storedName);
    }
  }, []);

  // 1. 계획 데이터 감시
  useEffect(() => {
    const q = query(collection(db, "plans"), where("date", "==", todayDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // 기본 정렬: 할 일 시간 순
      newTodos.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setTodos(newTodos); 
    });
    return () => unsubscribe();
  }, [todayDate]);

  // 2. 유저 정보 감시
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const info: any = {};
      snapshot.docs.forEach(doc => {
        info[doc.id] = doc.data(); 
      });
      setUsersInfo(info);
      if (myName && info[myName]) setMyAvatar(info[myName].avatar || "😎");
    });
    return () => unsubscribe();
  }, [myName]);

  // 입장
  const enterApp = async () => {
    if (!tempName.trim() || !tempPw.trim()) return alert("빈칸 채워주세요!");
    try {
      const userRef = doc(db, "users", tempName);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        if (userSnap.data().password === tempPw) {
          alert(`환영합니다 ${tempName}님!`);
          localStorage.setItem("godsaeng_user", tempName);
          setMyName(tempName);
          setMyAvatar(userSnap.data().avatar || "😎");
        } else {
          alert("비밀번호 땡!");
        }
      } else {
        if (confirm(`'${tempName}' 계정을 만들까요?`)) {
          await setDoc(userRef, { password: tempPw, avatar: "👶", createdAt: new Date() });
          alert("가입 완료!");
          localStorage.setItem("godsaeng_user", tempName);
          setMyName(tempName);
          setMyAvatar("👶");
        }
      }
    } catch (e) { console.error(e); alert("에러남 ㅠ"); }
  };

  const handleLogout = () => {
    if(confirm("진짜 로그아웃?")) {
      localStorage.removeItem("godsaeng_user");
      setMyName("");
    }
  }

  const addPlan = async () => {
    if (!todo.trim() || !time.trim()) return;
    await addDoc(collection(db, "plans"), {
      name: myName,
      time,
      task: todo,
      isDone: false,
      date: todayDate,
      createdAt: new Date(),
      reactions: {}
    });
    setTodo(""); 
  };

  // ⭐ 핵심 수정: 체크할 때 '시간(doneAt)'도 같이 저장!
  const toggleDone = async (id: string, currentStatus: boolean) => {
    const planRef = doc(db, "plans", id);
    if (!currentStatus) {
      // 체크박스 켤 때: 현재 시간 기록
      await updateDoc(planRef, { 
        isDone: true,
        doneAt: new Date() 
      });
    } else {
      // 체크박스 끌 때: 시간 삭제 (null)
      await updateDoc(planRef, { 
        isDone: false,
        doneAt: null 
      });
    }
  };
  
  const deletePlan = async (id: string) => {
    if (confirm("지울까요?")) await deleteDoc(doc(db, "plans", id));
  };

  const toggleReaction = async (planId: string, emoji: string) => {
    const plan = todos.find(t => t.id === planId);
    if (!plan) return;
    const currentReactions = plan.reactions || {};
    const usersWhoReacted = currentReactions[emoji] || [];
    let newUsersList;
    if (usersWhoReacted.includes(myName)) {
      newUsersList = usersWhoReacted.filter((user: string) => user !== myName);
    } else {
      newUsersList = [...usersWhoReacted, myName];
    }
    await updateDoc(doc(db, "plans", planId), { [`reactions.${emoji}`]: newUsersList });
  };

  const updateProfile = async (newAvatar: string, newPw: string) => {
    if (!newPw.trim()) return alert("비번 필수!");
    try {
      await updateDoc(doc(db, "users", myName), { avatar: newAvatar, password: newPw });
      alert("변경 완료!");
      setIsMyPageOpen(false);
    } catch (e) { alert("실패ㅠ"); }
  };

  // --- 화면 렌더링 준비 ---

  // 유저 목록 만들기 & ⭐ 정렬 로직 (최신순)
  const users = Array.from(new Set(todos.map(t => t.name)));
  if (!users.includes(myName)) users.unshift(myName);

  // 정렬 함수
  users.sort((a, b) => {
    if (a === myName) return -1; // 나는 무조건 1등
    if (b === myName) return 1;

    // 각 유저의 '가장 최근에 완료한 시간' 찾기
    const getLastDoneTime = (userName: string) => {
      const userTodos = todos.filter(t => t.name === userName && t.isDone && t.doneAt);
      if (userTodos.length === 0) return 0;
      // doneAt.seconds (타임스탬프) 중 가장 큰 값(최신) 찾기
      return Math.max(...userTodos.map(t => t.doneAt?.seconds || 0));
    };

    const timeA = getLastDoneTime(a);
    const timeB = getLastDoneTime(b);

    // 시간이 큰 사람(최신)이 위로 오게 내림차순 정렬
    return timeB - timeA;
  });


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

  return (
    <div className="min-h-screen bg-gray-900 p-4 text-white pb-20">
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 px-2">
        <h1 className="text-xl font-bold text-gray-300">📅 {todayDate}</h1>
        <div className="flex gap-3">
          <button onClick={() => setIsMyPageOpen(true)} className="bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600">⚙️ 내 정보</button>
          <button onClick={handleLogout} className="text-sm text-gray-500 underline">로그아웃</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-2 items-center sticky top-0 z-10 shadow-lg border border-gray-700">
        <span className="font-bold text-yellow-400 shrink-0 flex items-center gap-2">
          <span className="text-2xl">{myAvatar}</span> {myName}
        </span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-gray-700 text-white p-2 rounded outline-none"/>
        <input type="text" value={todo} onChange={(e) => setTodo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlan()} placeholder="할 일 입력" className="bg-gray-700 text-white p-2 rounded flex-1 outline-none w-full"/>
        <button onClick={addPlan} className="bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-500 w-full md:w-auto">추가</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {users.map((user) => (
          <div key={user} className={`rounded-xl p-4 border-2 min-h-[300px] ${user === myName ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50'}`}>
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center border-b border-gray-600 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{usersInfo[user]?.avatar || "😎"}</span>
                {user} {user === myName && " (나)"}
              </div>
              <span className="text-xs font-normal bg-gray-700 px-2 py-1 rounded">
                {Math.round((todos.filter(t => t.name === user && t.isDone).length / (todos.filter(t => t.name === user).length || 1)) * 100)}%
              </span>
            </h2>
            <ul className="space-y-3">
              {todos.filter(t => t.name === user).map((plan) => {
                // ⭐ 완료 시간 포맷팅 (예: 14:30)
                let doneTimeStr = "";
                if (plan.isDone && plan.doneAt) {
                  const date = new Date(plan.doneAt.seconds * 1000);
                  doneTimeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                }

                return (
                  <li key={plan.id} className="bg-gray-700/50 p-3 rounded hover:bg-gray-700 transition">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={plan.isDone} disabled={user !== myName} onChange={() => toggleDone(plan.id, plan.isDone)} className={`w-6 h-6 accent-green-500 shrink-0 ${user !== myName ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}/>
                      
                      {/* 시간 & 내용 */}
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono text-gray-400 shrink-0`}>{plan.time}</span>
                          {/* ⭐ 완료 시간 표시 */}
                          {plan.isDone && (
                            <span className="text-xs text-green-400 shrink-0">({doneTimeStr} 완료)</span>
                          )}
                        </div>
                        <span className={`break-all ${plan.isDone ? 'text-gray-500 line-through' : 'text-white'}`}>{plan.task}</span>
                      </div>
                      
                      {user === myName && (<button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 px-2 text-lg">×</button>)}
                    </div>
                    
                    <div className="flex gap-2 justify-end flex-wrap">
                      {REACTION_EMOJIS.map(emoji => {
                        const count = plan.reactions?.[emoji]?.length || 0;
                        const isReacted = plan.reactions?.[emoji]?.includes(myName);
                        const whoReacted = plan.reactions?.[emoji]?.join(", ") || "";
                        return (
                          <button 
                            key={emoji}
                            title={whoReacted}
                            onClick={() => toggleReaction(plan.id, emoji)}
                            className={`text-sm px-3 py-1.5 rounded-full flex items-center gap-1 transition
                              ${isReacted ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}
                            `}
                          >
                            <span>{emoji}</span>
                            {count > 0 && <span className="font-bold">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {isMyPageOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md border border-gray-600 relative">
            <button onClick={() => setIsMyPageOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-6 text-center">⚙️ 내 정보 수정</h2>
            <div className="mb-6">
              <label className="block text-gray-400 mb-2">프로필 아이콘</label>
              <div className="grid grid-cols-5 gap-2">
                {["😎", "🐰", "🐱", "🐶", "🦊", "🐻", "🐼", "🐯", "🦁", "🐮", "🐷", "🐸", "👻", "👽", "🐎"].map(emoji => (
                  <button key={emoji} onClick={() => setMyAvatar(emoji)} className={`text-2xl p-3 rounded ${myAvatar === emoji ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>{emoji}</button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-gray-400 mb-2">비밀번호 변경</label>
              <input type="password" placeholder="새 비번" id="newPwInput" className="w-full p-3 rounded bg-gray-700 text-white outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <button onClick={() => { const newPw = (document.getElementById("newPwInput") as HTMLInputElement).value; updateProfile(myAvatar, newPw || tempPw); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded text-lg">저장하기</button>
          </div>
        </div>
      )}
    </div>
  );
}