"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

export default function Home() {
  const [myName, setMyName] = useState(""); 
  const [tempName, setTempName] = useState("");
  
  // 입력 관련 상태
  const [time, setTime] = useState("");
  const [todo, setTodo] = useState("");
  
  // 전체 투두 리스트 (친구들 거 포함)
  const [todos, setTodos] = useState<any[]>([]);

  // 1. 데이터 가져오기 (감시 시작)
  useEffect(() => {
    // 'plans'라는 새 서랍을 씁니다. (시간 순서로 정렬)
    const q = query(collection(db, "plans"), orderBy("time", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTodos(newTodos); 
    });
    return () => unsubscribe();
  }, []);

  // 2. 계획 추가하기 (전날 or 당일에 입력)
  const addPlan = async () => {
    if (todo.trim() === "" || time.trim() === "") return alert("시간과 할 일을 적어주세요!");
    try {
      await addDoc(collection(db, "plans"), {
        name: myName,
        time: time,    // 예: "09:00"
        task: todo,    // 예: "기상 인증하기"
        isDone: false, // 처음엔 안 한 상태
        createdAt: new Date() 
      });
      setTodo(""); // 입력창 비우기
      // 시간은 연속으로 입력하기 편하게 안 비움
    } catch (e) {
      console.error("에러:", e);
    }
  };

  // 3. 체크박스 토글 (성공/취소)
  const toggleDone = async (id: string, currentStatus: boolean) => {
    const planRef = doc(db, "plans", id);
    await updateDoc(planRef, {
      isDone: !currentStatus // 반대로 뒤집기 (true <-> false)
    });
  };

  // 4. 삭제하기 (X 버튼)
  const deletePlan = async (id: string) => {
    if (confirm("진짜 지울까요?")) {
      await deleteDoc(doc(db, "plans", id));
    }
  };

  // 5. 입장 기능 (닉네임 설정)
  const enterApp = () => {
    if (tempName.trim() === "") return alert("이름을 입력해주세요!");
    setMyName(tempName);
  };

  // --- 화면 렌더링 ---

  // (1) 입장 전 화면
  if (myName === "") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-4xl font-bold mb-6">오늘도 파이팅 ^_^</h1>
        <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-sm text-center">
          <input 
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enterApp()}
            placeholder="닉네임 입력"
            className="w-full p-3 mb-4 rounded bg-gray-700 text-white text-center outline-none"
          />
          <button onClick={enterApp} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded">
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // (2) 메인 대시보드
  
  // 친구들 이름만 뽑아서 중복 제거 (누가누가 있나)
  const users = Array.from(new Set(todos.map(t => t.name)));
  // 내 이름이 목록에 없으면(처음 들어오면) 강제로 추가해서 내 판을 보여줌
  if (!users.includes(myName)) users.unshift(myName);
  // 내 이름을 맨 앞으로 정렬
  users.sort((a, b) => (a === myName ? -1 : b === myName ? 1 : 0));

  return (
    <div className="min-h-screen bg-gray-900 p-4 text-white">
      {/* 상단: 계획 입력기 */}
      <div className="max-w-4xl mx-auto bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-2 items-center sticky top-0 z-10 shadow-lg border border-gray-700">
        <span className="font-bold text-yellow-400 shrink-0">{myName}의 계획 추가 👉</span>
        <input 
          type="time" 
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-gray-700 text-white p-2 rounded outline-none"
        />
        <input 
          type="text" 
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPlan()}
          placeholder="할 일 (예: 1시간 독서)"
          className="bg-gray-700 text-white p-2 rounded flex-1 outline-none w-full"
        />
        <button onClick={addPlan} className="bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-500 w-full md:w-auto">
          추가
        </button>
      </div>

      {/* 하단: 상황판 (친구들 카드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {users.map((user) => (
          <div key={user} className={`rounded-xl p-4 border-2 min-h-[300px] ${user === myName ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50'}`}>
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center border-b border-gray-600 pb-2">
              {user} {user === myName && " (나)"}
              {/* 진행률 계산 (심화 기능) */}
              <span className="text-xs font-normal bg-gray-700 px-2 py-1 rounded">
                {Math.round((todos.filter(t => t.name === user && t.isDone).length / (todos.filter(t => t.name === user).length || 1)) * 100)}% 달성
              </span>
            </h2>

            {/* 그 사람의 할 일 목록 */}
            <ul className="space-y-2">
              {todos.filter(t => t.name === user).map((plan) => (
                <li key={plan.id} className="flex items-center gap-2 bg-gray-700/50 p-2 rounded hover:bg-gray-700 transition">
                  {/* 체크박스 (나만 내 거 누를 수 있게 할 수도 있지만, 일단 다 열어둠) */}
                  <input 
                    type="checkbox" 
                    checked={plan.isDone}
                    onChange={() => toggleDone(plan.id, plan.isDone)}
                    className="w-5 h-5 accent-green-500 cursor-pointer"
                  />
                  
                  <span className={`text-sm font-mono text-gray-400`}>{plan.time}</span>
                  
                  <span className={`flex-1 ${plan.isDone ? 'text-gray-500 line-through' : 'text-white'}`}>
                    {plan.task}
                  </span>

                  {/* 삭제 버튼 (본인 글만 지우게 하면 좋지만 일단 심플하게) */}
                  {user === myName && (
                    <button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-300 px-2">
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            
            {todos.filter(t => t.name === user).length === 0 && (
              <p className="text-center text-gray-500 mt-10 text-sm">등록된 계획이 없습니다 💤</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}