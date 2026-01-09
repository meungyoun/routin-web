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

type ThemeMode = 'dark' | 'light';
type ThemeColor = 'blue' | 'green' | 'pink';

export default function Home() {
  const [myName, setMyName] = useState(""); 
  const [myAvatar, setMyAvatar] = useState("😎"); 
  const [isMyPageOpen, setIsMyPageOpen] = useState(false); 

  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [themeColor, setThemeColor] = useState<ThemeColor>('blue');

  const [tempName, setTempName] = useState("");
  const [tempPw, setTempPw] = useState("");
  
  // ⭐ 시간 기본값 09:00
  const [time, setTime] = useState("09:00");
  const [todo, setTodo] = useState("");
  const [todos, setTodos] = useState<any[]>([]);
  const [usersInfo, setUsersInfo] = useState<any>({}); 

  const todayDate = getGodsaengDate();

  // 자동 로그인 & 테마 로드
  useEffect(() => {
    const storedName = localStorage.getItem("godsaeng_user");
    if (storedName) setMyName(storedName);

    const storedMode = localStorage.getItem("godsaeng_theme_mode") as ThemeMode;
    const storedColor = localStorage.getItem("godsaeng_theme_color") as ThemeColor;
    if (storedMode) setThemeMode(storedMode);
    if (storedColor) setThemeColor(storedColor);
  }, []);

  const saveTheme = (mode: ThemeMode, color: ThemeColor) => {
    setThemeMode(mode);
    setThemeColor(color);
    localStorage.setItem("godsaeng_theme_mode", mode);
    localStorage.setItem("godsaeng_theme_color", color);
  };

  // 데이터 감시
  useEffect(() => {
    const q = query(collection(db, "plans"), where("date", "==", todayDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      newTodos.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setTodos(newTodos); 
    });
    return () => unsubscribe();
  }, [todayDate]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const info: any = {};
      snapshot.docs.forEach(doc => { info[doc.id] = doc.data(); });
      setUsersInfo(info);
      if (myName && info[myName]) setMyAvatar(info[myName].avatar || "😎");
    });
    return () => unsubscribe();
  }, [myName]);

  // 기능 함수들
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
          // 승연님 문구 유지
          alert("비밀번호가 맞지 않습니다.");
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
    } catch (e) { console.error(e); alert("error: 화면 캡쳐해서 뽀삐한테 보내주세욤"); }
  };

  const handleLogout = () => {
    if(confirm("진짜 로그아웃?")) {
      localStorage.removeItem("godsaeng_user");
      setMyName("");
    }
  }

  const addPlan = async () => {
    if (!todo.trim()) return;
    await addDoc(collection(db, "plans"), {
      name: myName, time, task: todo, isDone: false, date: todayDate, createdAt: new Date(), reactions: {}
    });
    setTodo(""); 
  };

  const toggleDone = async (id: string, currentStatus: boolean) => {
    const planRef = doc(db, "plans", id);
    if (!currentStatus) await updateDoc(planRef, { isDone: true, doneAt: new Date() });
    else await updateDoc(planRef, { isDone: false, doneAt: null });
  };
  
  const deletePlan = async (id: string) => {
    if (confirm("지울까요?")) await deleteDoc(doc(db, "plans", id));
  };

  const toggleReaction = async (planId: string, emoji: string) => {
    const plan = todos.find(t => t.id === planId);
    if (!plan) return;
    const currentReactions = plan.reactions || {};
    const usersWhoReacted = currentReactions[emoji] || [];
    let newUsersList = usersWhoReacted.includes(myName) 
      ? usersWhoReacted.filter((user: string) => user !== myName)
      : [...usersWhoReacted, myName];
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

  // ⭐ 시간 변경 핸들러
  // ⭐ 시간 변경 핸들러 (수정됨: 30분 단위 강제 보정)
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    
    // 입력된 분(Minute) 확인
    const [h, m] = val.split(':');
    const minute = parseInt(m);

    // 30분 단위가 아니면, 가까운 쪽으로 강제 변경 (00 또는 30)
    // 예: 9:12 -> 9:00 / 9:40 -> 9:30
    if (minute !== 0 && minute !== 30) {
      const newMinute = minute < 15 ? "00" : minute < 45 ? "30" : "00";
      // 45분 이상이라 00으로 갈 때 시간을 올리는 건 복잡하니, 일단 현재 시간의 00분으로 맞춤
      setTime(`${h}:${newMinute}`);
    } else {
      setTime(val);
    }
  };
  // 스타일 생성
  const getThemeStyles = () => {
    const base = themeMode === 'dark' 
      ? { bg: 'bg-gray-900', text: 'text-white', card: 'bg-gray-800', input: 'bg-gray-700 text-white', border: 'border-gray-700' }
      : { bg: 'bg-gray-50', text: 'text-gray-900', card: 'bg-white shadow-sm border border-gray-200', input: 'bg-white text-gray-900 border border-gray-300', border: 'border-gray-200' };

    let accent = { btn: 'bg-blue-600', text: 'text-blue-600', ring: 'focus:ring-blue-500', border: 'border-blue-500', checkbox: 'accent-blue-500' };
    if (themeColor === 'green') accent = { btn: 'bg-green-600', text: 'text-green-600', ring: 'focus:ring-green-500', border: 'border-green-500', checkbox: 'accent-green-500' };
    if (themeColor === 'pink') accent = { btn: 'bg-pink-500', text: 'text-pink-500', ring: 'focus:ring-pink-400', border: 'border-pink-400', checkbox: 'accent-pink-500' };

    return { ...base, ...accent };
  };

  const theme = getThemeStyles();

  // 정렬 로직
  const users = Array.from(new Set(todos.map(t => t.name)));
  if (!users.includes(myName)) users.unshift(myName);
  users.sort((a, b) => {
    if (a === myName) return -1; 
    if (b === myName) return 1;
    const getLastDoneTime = (userName: string) => {
      const userTodos = todos.filter(t => t.name === userName && t.isDone && t.doneAt);
      if (userTodos.length === 0) return 0;
      return Math.max(...userTodos.map(t => t.doneAt?.seconds || 0));
    };
    return getLastDoneTime(b) - getLastDoneTime(a);
  });

  if (myName === "") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-4xl font-bold mb-4">ദ്ദി❁´◡`❁</h1>
        <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-sm text-center border border-gray-700">
          <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="닉네임" className="w-full p-3 mb-3 rounded bg-gray-700 text-white outline-none"/>
          <input type="password" value={tempPw} onChange={(e) => setTempPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enterApp()} placeholder="비밀번호" className="w-full p-3 mb-6 rounded bg-gray-700 text-white outline-none"/>
          <button onClick={enterApp} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded">입장하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 pb-20 transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 px-2">
        <h1 className={`text-xl font-bold ${themeMode === 'light' ? 'text-gray-800' : 'text-gray-300'}`}>📅 {todayDate}</h1>
        <div className="flex gap-3">
          <button onClick={() => setIsMyPageOpen(true)} className={`${themeMode === 'light' ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-700 hover:bg-gray-600'} px-3 py-1 rounded text-sm transition`}>⚙️ 설정</button>
          <button onClick={handleLogout} className="text-sm text-gray-500 underline">로그아웃</button>
        </div>
      </div>

      <div className={`max-w-4xl mx-auto p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-2 items-center sticky top-0 z-10 shadow-lg ${theme.card}`}>
        <span className={`font-bold shrink-0 flex items-center gap-2 ${theme.text}`}>
          <span className="text-2xl">{myAvatar}</span> {myName}
        </span>
        
        {/* ⭐ 다시 깔끔한 시계 디자인으로 복귀 (30분 단위 step 적용) */}
        <input 
          type="time" 
          value={time} 
          onChange={handleTimeChange}
          step="1800" 
          className={`p-2 rounded outline-none cursor-pointer text-center font-bold text-lg ${theme.input}`}
        />

        <input type="text" value={todo} onChange={(e) => setTodo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlan()} placeholder="할 일 입력" className={`p-2 rounded flex-1 outline-none w-full ${theme.input}`}/>
        <button onClick={addPlan} className={`px-6 py-2 rounded font-bold hover:opacity-90 w-full md:w-auto text-white ${theme.btn}`}>추가</button>
      </div>

      {/* 상황판 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {users.map((user) => {
          const userTodos = todos.filter(t => t.name === user);
          const totalCount = userTodos.length;
          const doneCount = userTodos.filter(t => t.isDone).length;
          const isAllDone = totalCount > 0 && totalCount === doneCount;

          return (
            <div key={user} className={`rounded-xl p-4 border-2 min-h-[300px] flex flex-col ${user === myName ? `${theme.border} ${theme.card}` : `${theme.border} ${themeMode === 'dark' ? 'bg-gray-800/50' : 'bg-white/50'}`}`}>
              <h2 className={`text-xl font-bold mb-4 flex justify-between items-center border-b pb-2 ${themeMode === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{usersInfo[user]?.avatar || "😎"}</span>
                  {user} {user === myName && " (나)"}
                </div>
                <span className={`text-xs font-normal px-2 py-1 rounded ${themeMode === 'dark' ? 'bg-gray-700' : 'bg-gray-200 text-gray-700'}`}>
                  {Math.round((doneCount / (totalCount || 1)) * 100)}%
                </span>
              </h2>

              <ul className="space-y-3 flex-1">
                {userTodos.map((plan) => {
                  let doneTimeStr = "";
                  if (plan.isDone && plan.doneAt) {
                    const date = new Date(plan.doneAt.seconds * 1000);
                    doneTimeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                  }
                  return (
                    <li key={plan.id} className={`p-3 rounded transition ${themeMode === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={plan.isDone} disabled={user !== myName} onChange={() => toggleDone(plan.id, plan.isDone)} className={`w-6 h-6 shrink-0 ${theme.checkbox} ${user !== myName ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}/>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-mono shrink-0 ${themeMode === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{plan.time}</span>
                            {plan.isDone && <span className={`text-xs shrink-0 ${theme.text}`}>({doneTimeStr} 완료)</span>}
                          </div>
                          <span className={`break-all ${plan.isDone ? 'text-gray-500 line-through' : theme.text}`}>{plan.task}</span>
                        </div>
                        {user === myName && (<button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 px-2 text-lg">×</button>)}
                      </div>
                      <div className="flex gap-2 justify-end flex-wrap">
                        {REACTION_EMOJIS.map(emoji => {
                          const count = plan.reactions?.[emoji]?.length || 0;
                          const isReacted = plan.reactions?.[emoji]?.includes(myName);
                          const whoReacted = plan.reactions?.[emoji]?.join(", ") || "";
                          return (
                            <button key={emoji} title={whoReacted} onClick={() => toggleReaction(plan.id, emoji)} className={`text-sm px-3 py-1.5 rounded-full flex items-center gap-1 transition ${isReacted ? `${theme.btn} text-white` : `${themeMode === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}`}>
                              <span>{emoji}</span> {count > 0 && <span className="font-bold">{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {isAllDone && (
                <div className={`mt-4 p-3 rounded-lg text-center font-bold animate-bounce ${themeMode === 'dark' ? 'bg-gray-700 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
                  {/* 승연님 문구 유지 */}
                  목표 달성을 축하합니다! ദി ᷇ᵕ ᷆ )♡
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isMyPageOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-2xl w-full max-w-md border relative ${themeMode === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
            <button onClick={() => setIsMyPageOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-6 text-center">⚙️ 설정</h2>
            
            <div className="mb-6">
              <label className={`block mb-2 font-bold ${themeMode === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>프로필 아이콘</label>
              <div className="grid grid-cols-5 gap-2">
                {["😎", "🐰", "🐱", "🐶", "🦊", "🐻", "🐼", "🐯", "🦁", "🐮", "🐷", "🐸", "👻", "👽", "🐎"].map(emoji => (
                  <button key={emoji} onClick={() => setMyAvatar(emoji)} className={`text-2xl p-3 rounded ${myAvatar === emoji ? theme.btn : (themeMode === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')}`}>{emoji}</button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className={`block mb-2 font-bold ${themeMode === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>화면 모드</label>
              <div className="flex gap-2 mb-4">
                <button onClick={() => saveTheme('dark', themeColor)} className={`flex-1 py-2 rounded border ${themeMode === 'dark' ? 'border-blue-500 bg-gray-700 text-white' : 'border-gray-300 text-gray-500'}`}>🌑 다크</button>
                <button onClick={() => saveTheme('light', themeColor)} className={`flex-1 py-2 rounded border ${themeMode === 'light' ? 'border-blue-500 bg-blue-50 text-blue-600 font-bold' : 'border-gray-600 text-gray-400'}`}>☀️ 라이트</button>
              </div>

              <label className={`block mb-2 font-bold ${themeMode === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>색 테마</label>
              <div className="flex gap-2">
                <button onClick={() => saveTheme(themeMode, 'blue')} className={`flex-1 py-2 rounded text-white bg-blue-600 ${themeColor === 'blue' ? 'ring-4 ring-blue-300' : 'opacity-50'}`}>블루</button>
                <button onClick={() => saveTheme(themeMode, 'green')} className={`flex-1 py-2 rounded text-white bg-green-600 ${themeColor === 'green' ? 'ring-4 ring-green-300' : 'opacity-50'}`}>그린</button>
                <button onClick={() => saveTheme(themeMode, 'pink')} className={`flex-1 py-2 rounded text-white bg-pink-500 ${themeColor === 'pink' ? 'ring-4 ring-pink-300' : 'opacity-50'}`}>핑크</button>
              </div>
            </div>

            <div className="mb-6">
              <label className={`block mb-2 font-bold ${themeMode === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>비밀번호 변경</label>
              <input type="password" placeholder="새 비번" id="newPwInput" className={`w-full p-3 rounded outline-none ${theme.input}`}/>
            </div>
            
            <button onClick={() => { const newPw = (document.getElementById("newPwInput") as HTMLInputElement).value; updateProfile(myAvatar, newPw || tempPw); }} className={`w-full font-bold py-3 rounded text-lg text-white hover:opacity-90 ${theme.btn}`}>저장하기</button>
          </div>
        </div>
      )}
    </div>
  );
}