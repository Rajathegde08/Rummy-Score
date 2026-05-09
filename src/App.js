import { useState, useRef } from "react";

const COLORS = [
  "#FF6B6B","#4ECDC4","#FFD93D","#6BCB77",
  "#845EC2","#FF9671","#00B4D8","#F72585",
  "#90BE6D","#F9844A",
];
const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

function useSound() {
  const ctx = useRef(null);
  const getCtx = () => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.current;
  };
  const playBust = () => {
    try {
      const c = getCtx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sawtooth"; o.frequency.setValueAtTime(300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.4);
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
      o.start(); o.stop(c.currentTime + 0.4);
    } catch(e) {}
  };
  const playWin = () => {
    try {
      const c = getCtx();
      [523,659,784,1047].forEach((freq, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = "sine"; o.frequency.value = freq;
        const t = c.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.3);
      });
    } catch(e) {}
  };
  const playTick = () => {
    try {
      const c = getCtx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine"; o.frequency.value = 440;
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      o.start(); o.stop(c.currentTime + 0.1);
    } catch(e) {}
  };
  return { playBust, playWin, playTick };
}

function Modal({ title, children, onClose, T }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.surface, borderRadius:20, padding:28, width:"100%", maxWidth:400, color:T.text, border:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState("setup");
  const [players, setPlayers] = useState([{ name:"", id:0 }, { name:"", id:1 }]);
  const [targetScore, setTargetScore] = useState(200);
  const [rounds, setRounds] = useState([]);
  const [currentInput, setCurrentInput] = useState({});
  const [bustedPlayers, setBustedPlayers] = useState(new Set());
  const [reentryModal, setReentryModal] = useState(null);
  const [reentryScore, setReentryScore] = useState("");
  const [confetti, setConfetti] = useState([]);
  const [endModal, setEndModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [gameHistory, setGameHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rummy_v2_history") || "[]"); } catch { return []; }
  });

  const sound = useSound();

  const T = {
    bg:      dark ? "#0f0f0f" : "#f5f3ee",
    surface: dark ? "#1a1a1a" : "#ffffff",
    surface2:dark ? "#111111" : "#f0ede8",
    border:  dark ? "#2a2a2a" : "#e0ddd8",
    text:    dark ? "#f0ece0" : "#1a1a1a",
    muted:   dark ? "#555555" : "#999999",
    muted2:  dark ? "#888888" : "#666666",
  };

  const addPlayer = () => { if (players.length < 10) setPlayers([...players, { name:"", id:Date.now() }]); };
  const removePlayer = (id) => { if (players.length > 2) setPlayers(players.filter(p => p.id !== id)); };
  const updateName = (id, name) => setPlayers(players.map(p => p.id === id ? { ...p, name } : p));

  const startGame = () => {
    const named = players.map((p, i) => ({ ...p, name: p.name.trim() || `Player ${i+1}` }));
    setPlayers(named);
    const init = {};
    named.forEach(p => { init[p.id] = ""; });
    setCurrentInput(init);
    setScreen("game");
  };

  const getTotals = (roundsArr) => {
    const arr = roundsArr !== undefined ? roundsArr : rounds;
    const totals = {};
    players.forEach(p => (totals[p.id] = 0));
    arr.forEach(r => { players.forEach(p => { totals[p.id] += r[p.id] ?? 0; }); });
    return totals;
  };

  const activePlayers = players.filter(p => !bustedPlayers.has(p.id));

  const addRound = () => {
    const round = {};
    let allFilled = true;
    activePlayers.forEach(p => {
      const val = parseInt(currentInput[p.id]);
      if (isNaN(val)) { allFilled = false; return; }
      round[p.id] = val;
    });
    bustedPlayers.forEach(id => { round[id] = 0; });
    if (!allFilled) return;
    sound.playTick();
    const newRounds = [...rounds, round];
    setRounds(newRounds);
    const newTotals = getTotals(newRounds);
    const newlyBusted = activePlayers.filter(p => newTotals[p.id] >= targetScore);
    if (newlyBusted.length > 0) {
      setTimeout(() => sound.playBust(), 100);
      const newBusted = new Set(bustedPlayers);
      newlyBusted.forEach(p => newBusted.add(p.id));
      setBustedPlayers(newBusted);
    }
    const reset = {};
    players.forEach(p => { reset[p.id] = ""; });
    setCurrentInput(reset);
  };

  const openReentry = (playerId) => { setReentryModal(playerId); setReentryScore(""); };
  const confirmReentry = () => {
    const val = parseInt(reentryScore);
    if (isNaN(val) || val < 0) return;
    const currentTotals = getTotals();
    const delta = val - currentTotals[reentryModal];
    const adjRound = {};
    players.forEach(p => { adjRound[p.id] = 0; });
    adjRound[reentryModal] = delta;
    adjRound.__reentry = reentryModal;
    setRounds(prev => [...prev, adjRound]);
    const newBusted = new Set(bustedPlayers);
    newBusted.delete(reentryModal);
    setBustedPlayers(newBusted);
    setReentryModal(null);
  };

  const shootConfetti = () => {
    const dots = Array.from({ length:60 }, (_, i) => ({ id:i, x:Math.random()*window.innerWidth, color:COLORS[Math.floor(Math.random()*COLORS.length)] }));
    setConfetti(dots);
    setTimeout(() => setConfetti([]), 1600);
  };

  const saveToHistory = (t) => {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }),
      time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }),
      players: players.map(p => ({ name:p.name, score:t[p.id], id:p.id })),
      winner: [...players].sort((a,b) => t[a.id]-t[b.id])[0].name,
      rounds: rounds.filter(r => !r.__reentry).length,
      target: targetScore,
    };
    const newHistory = [entry, ...gameHistory].slice(0, 50);
    setGameHistory(newHistory);
    try { localStorage.setItem("rummy_v2_history", JSON.stringify(newHistory)); } catch(e) {}
    return entry;
  };

  const endGame = () => {
    sound.playWin();
    shootConfetti();
    saveToHistory(getTotals());
    setEndModal(true);
  };

  const resetGame = () => {
    setRounds([]); setBustedPlayers(new Set()); setEndModal(false);
    setScreen("setup"); setPlayers([{ name:"", id:0 },{ name:"", id:1 }]);
    setCurrentInput({}); setTargetScore(200);
  };

  const deleteRound = (idx) => setRounds(rounds.filter((_, i) => i !== idx));
  const totals = getTotals();
  const sorted = [...players].sort((a, b) => totals[a.id] - totals[b.id]);
  const playerIndex = (id) => players.findIndex(p => p.id === id);

  const buildShareText = (title) => {
    const t = getTotals();
    const lines = [...players].sort((a,b)=>t[a.id]-t[b.id])
      .map((p,i) => `${MEDALS[i]} ${p.name} — ${t[p.id]} pts${bustedPlayers.has(p.id)?" 💀":""}`)
      .join("\n");
    return `🃏 *${title}*\n\n${lines}\n\nTrack yours → https://rummyscoretrack.netlify.app`;
  };

  const shareNow = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

  return (
    <div style={{ fontFamily:"Georgia, serif", minHeight:"100vh", background:T.bg, color:T.text, transition:"background 0.25s, color 0.25s" }}>
      <style>{`
        @keyframes fall { to { transform:translateY(105vh) rotate(720deg); opacity:0; } }
        @keyframes slideUp { from { transform:translateY(14px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        .row-anim { animation:slideUp 0.22s ease forwards; }
        input:focus { outline:none; border-color:#FFD93D !important; }
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#444; border-radius:2px; }
        button { font-family:Georgia,serif; }
      `}</style>

      {confetti.map(d => (
        <div key={d.id} style={{ position:"fixed", left:d.x, top:-10, width:8, height:8, borderRadius:"50%", background:d.color, pointerEvents:"none", animation:"fall 1.4s ease-out forwards", zIndex:9999 }}/>
      ))}

      {/* ════ SETUP ════ */}
      {screen === "setup" && (
        <div style={{ maxWidth:460, margin:"0 auto", padding:"28px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
            <div>
              <div style={{ fontSize:34, marginBottom:4 }}>
                {["♠","♥","♦","♣"].map((s,i) => <span key={i} style={{ color:i%2===0?T.text:"#FF6B6B", marginRight:2 }}>{s}</span>)}
              </div>
              <h1 style={{ fontSize:22, margin:0, letterSpacing:3, fontWeight:700 }}>RUMMY SCORE</h1>
              <p style={{ color:T.muted, marginTop:3, fontSize:11 }}>No pen. No paper. Just play.</p>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setHistoryModal(true)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 12px", color:T.muted2, cursor:"pointer", fontSize:13 }}>📊</button>
              <button onClick={() => setDark(!dark)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 12px", color:T.muted2, cursor:"pointer", fontSize:16 }}>{dark?"☀️":"🌙"}</button>
            </div>
          </div>

          <div style={{ background:T.surface, borderRadius:16, padding:22, marginBottom:16, border:`1px solid ${T.border}` }}>
            <label style={{ fontSize:11, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Players ({players.length}/10)</label>
            {players.map((p, i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginTop:11 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(p.name[0]||(i+1)).toString().toUpperCase()}
                </div>
                <input value={p.name} onChange={e => updateName(p.id, e.target.value)} placeholder={`Player ${i+1}`}
                  style={{ flex:1, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", color:T.text, fontSize:15 }} />
                {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20, padding:4 }}>×</button>}
              </div>
            ))}
            {players.length < 10 && (
              <button onClick={addPlayer} style={{ width:"100%", marginTop:12, padding:10, background:T.surface2, border:`1px dashed ${T.border}`, borderRadius:8, color:T.muted, cursor:"pointer", fontSize:14 }}>+ Add Player</button>
            )}
          </div>

          <div style={{ background:T.surface, borderRadius:16, padding:22, marginBottom:22, border:`1px solid ${T.border}` }}>
            <label style={{ fontSize:11, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Bust Limit</label>
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              {[100,200,300,500].map(v => (
                <button key={v} onClick={() => setTargetScore(v)} style={{ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", background:targetScore===v?"#FFD93D":T.surface2, color:targetScore===v?"#111":T.muted2, fontWeight:600, fontSize:14 }}>{v}</button>
              ))}
              <input type="number" value={targetScore} onChange={e => setTargetScore(Number(e.target.value))}
                style={{ width:80, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", color:T.text, fontSize:14 }} />
            </div>
          </div>

          <button onClick={startGame} style={{ width:"100%", padding:16, background:"#FFD93D", border:"none", borderRadius:12, fontSize:17, fontWeight:700, color:"#111", cursor:"pointer", letterSpacing:1 }}>Start Game →</button>
        </div>
      )}

      {/* ════ GAME ════ */}
      {screen === "game" && (
        <div style={{ maxWidth:620, margin:"0 auto", padding:"18px 14px 48px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <h2 style={{ margin:0, fontSize:19, letterSpacing:1 }}>♣ Round {rounds.filter(r=>!r.__reentry).length + 1}</h2>
              <p style={{ margin:0, color:T.muted, fontSize:12 }}>Bust at {targetScore} · {activePlayers.length} active · {bustedPlayers.size} busted</p>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => shareNow(buildShareText(`Rummy — Round ${rounds.filter(r=>!r.__reentry).length}`))} style={{ background:"#25D366", border:"none", borderRadius:8, padding:"7px 11px", color:"#fff", cursor:"pointer", fontSize:13 }}>📱</button>
              <button onClick={() => setDark(!dark)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 10px", color:T.muted2, cursor:"pointer", fontSize:14 }}>{dark?"☀️":"🌙"}</button>
              <button onClick={endGame} style={{ background:"#FFD93D", border:"none", borderRadius:8, padding:"7px 12px", color:"#111", cursor:"pointer", fontSize:13, fontWeight:700 }}>End</button>
              <button onClick={resetGame} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 10px", color:T.muted, cursor:"pointer", fontSize:13 }}>↺</button>
            </div>
          </div>

          <div style={{ overflowX:"auto", marginBottom:16 }}>
            <div style={{ minWidth: players.length > 5 ? players.length*72+56 : "auto" }}>
              <div style={{ background:T.surface, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ padding:"10px 8px", fontSize:10, color:T.muted, textTransform:"uppercase" }}>#</div>
                  {players.map((p, i) => {
                    const busted = bustedPlayers.has(p.id);
                    return (
                      <div key={p.id} style={{ padding:"8px 4px", textAlign:"center", opacity:busted?0.4:1 }}>
                        <div style={{ width:26, height:26, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", margin:"0 auto 2px", position:"relative" }}>
                          {p.name[0]?.toUpperCase()||(i+1)}
                          {busted && <span style={{ position:"absolute", top:-3, right:-3, fontSize:8, background:"#FF6B6B", borderRadius:"50%", width:13, height:13, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>✕</span>}
                        </div>
                        <div style={{ fontSize:10, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:54 }}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>

                {rounds.map((r, idx) => {
                  const isReentry = !!r.__reentry;
                  const roundNum = rounds.slice(0,idx+1).filter(x=>!x.__reentry).length;
                  return (
                    <div key={idx} className="row-anim" style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, borderBottom:`1px solid ${T.border}`, alignItems:"center", background:isReentry?(dark?"#181200":"#fffbe6"):"transparent" }}>
                      <div style={{ padding:"7px 8px", fontSize:10, display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ color:isReentry?"#FFD93D":T.muted }}>{isReentry?"↩":("#"+roundNum)}</span>
                        <button onClick={() => deleteRound(idx)} style={{ background:"none", border:"none", color:T.border, cursor:"pointer", fontSize:13, padding:0 }}>×</button>
                      </div>
                      {players.map((p, i) => {
                        const val = r[p.id] ?? 0;
                        const isRe = isReentry && r.__reentry === p.id;
                        return (
                          <div key={p.id} style={{ padding:"7px 4px", textAlign:"center", fontSize:12, color:isRe?"#FFD93D":val===0&&!isReentry?COLORS[i%COLORS.length]:T.muted2, fontWeight:(isRe||val===0)?700:400 }}>
                            {isRe?(val>=0?`+${val}`:val):val===0&&!isReentry?"WIN":val===0&&bustedPlayers.has(p.id)?"—":val}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, background:T.surface2, borderTop:`2px solid ${T.border}` }}>
                  <div style={{ padding:"10px 8px", fontSize:10, color:T.muted, textTransform:"uppercase" }}>Total</div>
                  {players.map((p, i) => {
                    const t = totals[p.id]; const busted = bustedPlayers.has(p.id); const pct = Math.min((t/targetScore)*100,100);
                    return (
                      <div key={p.id} style={{ padding:"8px 4px", textAlign:"center", opacity:busted?0.5:1 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:busted?"#FF6B6B":t>targetScore*0.8?"#FFB347":T.text }}>{t}</div>
                        {busted && <div style={{ fontSize:8, color:"#FF6B6B", marginTop:1 }}>BUSTED</div>}
                        <div style={{ height:3, background:T.border, borderRadius:2, margin:"4px 6px 0", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:busted?"#FF6B6B":COLORS[i%COLORS.length], borderRadius:2, transition:"width 0.4s" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {bustedPlayers.size > 0 && (
            <div style={{ background:dark?"#160808":"#fff5f5", border:"1px solid #3a1515", borderRadius:14, padding:16, marginBottom:14 }}>
              <p style={{ margin:"0 0 12px", fontSize:11, color:"#FF6B6B", textTransform:"uppercase", letterSpacing:1 }}>💀 Busted — tap to re-enter</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {[...bustedPlayers].map(id => {
                  const p = players.find(x => x.id === id); const pi = playerIndex(id);
                  return (
                    <div key={id} style={{ display:"flex", alignItems:"center", gap:8, background:T.surface2, borderRadius:10, padding:"8px 12px" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>{p?.name[0]?.toUpperCase()}</div>
                      <span style={{ fontSize:13, color:T.muted2 }}>{p?.name}</span>
                      <span style={{ fontSize:11, color:"#FF6B6B", fontWeight:700 }}>{totals[id]}</span>
                      <button onClick={() => openReentry(id)} style={{ background:"#FFD93D", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#111", cursor:"pointer" }}>Re-enter</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activePlayers.length > 0 ? (
            <div style={{ background:T.surface, borderRadius:16, padding:18, border:`1px solid ${T.border}` }}>
              <p style={{ margin:"0 0 14px", fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Enter scores — Round {rounds.filter(r=>!r.__reentry).length + 1}</p>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(activePlayers.length,3)}, 1fr)`, gap:10, marginBottom:12 }}>
                {activePlayers.map(p => {
                  const i = playerIndex(p.id);
                  return (
                    <div key={p.id}>
                      <label style={{ fontSize:11, color:COLORS[i%COLORS.length], display:"block", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</label>
                      <input type="number" value={currentInput[p.id] ?? ""} onChange={e => setCurrentInput({ ...currentInput, [p.id]: e.target.value })}
                        placeholder="0" min="0"
                        style={{ width:"100%", background:T.surface2, border:`1.5px solid ${COLORS[i%COLORS.length]}55`, borderRadius:10, padding:"11px 8px", color:T.text, fontSize:20, textAlign:"center", fontFamily:"Georgia,serif" }} />
                    </div>
                  );
                })}
              </div>
              <p style={{ margin:"0 0 10px", fontSize:11, color:T.muted, textAlign:"center" }}>Enter 0 for the round winner</p>
              <button onClick={addRound} style={{ width:"100%", padding:14, background:"#FFD93D", border:"none", borderRadius:10, fontSize:16, fontWeight:700, color:"#111", cursor:"pointer" }}>Add Round ＋</button>
            </div>
          ) : (
            <div style={{ background:T.surface, borderRadius:16, padding:24, textAlign:"center", border:`1px solid ${T.border}` }}>
              <p style={{ color:"#FF6B6B", fontSize:15, margin:0 }}>All players busted!</p>
              <p style={{ color:T.muted, fontSize:13, marginTop:6 }}>Re-enter players above or end the game.</p>
            </div>
          )}

          {rounds.length > 0 && (
            <div style={{ marginTop:14, background:T.surface, borderRadius:16, padding:18, border:`1px solid ${T.border}` }}>
              <p style={{ margin:"0 0 12px", fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Standings</p>
              {sorted.map((p, rank) => {
                const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9, opacity:busted?0.45:1 }}>
                    <span style={{ fontSize:15, width:22 }}>{MEDALS[rank]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:13 }}>{p.name}{busted?" 💀":""}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:busted?"#FF6B6B":totals[p.id]>targetScore*0.8?"#FFB347":T.text }}>{totals[p.id]}</span>
                      </div>
                      <div style={{ height:3, background:T.border, borderRadius:2, marginTop:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.min((totals[p.id]/targetScore)*100,100)}%`, background:busted?"#FF6B6B":COLORS[pi%COLORS.length], borderRadius:2, transition:"width 0.4s" }}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ RE-ENTRY MODAL ════ */}
      {reentryModal !== null && (
        <Modal title={`↩ Re-enter ${players.find(p=>p.id===reentryModal)?.name}`} onClose={() => setReentryModal(null)} T={T}>
          <p style={{ color:T.muted2, fontSize:13, margin:"0 0 4px" }}>Current score: <strong style={{ color:"#FF6B6B" }}>{totals[reentryModal]} pts</strong></p>
          <p style={{ color:T.muted2, fontSize:13, margin:"0 0 16px" }}>Enter the agreed re-entry score:</p>
          <input type="number" value={reentryScore} onChange={e => setReentryScore(e.target.value)}
            placeholder={`e.g. ${targetScore - 20}`} autoFocus
            style={{ width:"100%", background:T.surface2, border:"1.5px solid #FFD93D", borderRadius:10, padding:"14px 12px", color:T.text, fontSize:22, textAlign:"center", fontFamily:"Georgia,serif", marginBottom:16 }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setReentryModal(null)} style={{ flex:1, padding:12, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, color:T.muted2, cursor:"pointer", fontSize:14 }}>Cancel</button>
            <button onClick={confirmReentry} style={{ flex:1, padding:12, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer", fontSize:14 }}>Confirm ↩</button>
          </div>
        </Modal>
      )}

      {/* ════ END GAME MODAL ════ */}
      {endModal && (
        <Modal title="🏆 Game Over" onClose={() => setEndModal(false)} T={T}>
          <p style={{ color:T.muted2, fontSize:13, margin:"0 0 16px" }}>Final standings — lowest score wins!</p>
          {sorted.map((p, rank) => {
            const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10, padding:"10px 14px", background:rank===0?(dark?"#1f1a00":"#fffbe6"):T.surface2, borderRadius:10, border:rank===0?"1px solid #FFD93D44":`1px solid ${T.border}` }}>
                <span style={{ fontSize:18 }}>{MEDALS[rank]}</span>
                <div style={{ width:26, height:26, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff" }}>{p.name[0]?.toUpperCase()}</div>
                <span style={{ flex:1, fontSize:14 }}>{p.name}{busted?" 💀":""}</span>
                <span style={{ fontSize:16, fontWeight:700, color:rank===0?"#FFD93D":busted?"#FF6B6B":T.text }}>{totals[p.id]}</span>
              </div>
            );
          })}
          <button onClick={() => shareNow(buildShareText("Rummy Game Over!"))} style={{ width:"100%", padding:13, background:"#25D366", border:"none", borderRadius:10, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:15, marginTop:8 }}>
            📱 Share on WhatsApp
          </button>
          <div style={{ display:"flex", gap:10, marginTop:10 }}>
            <button onClick={() => { setEndModal(false); setRounds([]); setBustedPlayers(new Set()); const init={}; players.forEach(p=>{init[p.id]="";}); setCurrentInput(init); }}
              style={{ flex:1, padding:12, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, color:T.muted2, cursor:"pointer", fontSize:14 }}>Rematch ↺</button>
            <button onClick={resetGame} style={{ flex:1, padding:12, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer", fontSize:14 }}>New Game →</button>
          </div>
        </Modal>
      )}

      {/* ════ HISTORY MODAL ════ */}
      {historyModal && (
        <Modal title="📊 Game History" onClose={() => setHistoryModal(false)} T={T}>
          {gameHistory.length === 0 ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:T.muted }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🃏</div>
              <p style={{ fontSize:14 }}>No games yet — play one!</p>
            </div>
          ) : (
            <div style={{ maxHeight:420, overflowY:"auto" }}>
              {gameHistory.map((g) => (
                <div key={g.id} style={{ background:T.surface2, borderRadius:12, padding:14, marginBottom:10, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>🏆 {g.winner}</span>
                    <span style={{ fontSize:11, color:T.muted }}>{g.date} · {g.rounds}R</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {[...g.players].sort((a,b)=>a.score-b.score).map((p,i) => (
                      <span key={p.id} style={{ fontSize:12, color:i===0?"#FFD93D":T.muted2 }}>
                        {MEDALS[i]} {p.name} {p.score}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => { if(window.confirm("Clear all history?")) { setGameHistory([]); try { localStorage.removeItem("rummy_v2_history"); } catch(e){} } }}
                style={{ width:"100%", padding:10, background:"none", border:`1px solid #FF6B6B44`, borderRadius:8, color:"#FF6B6B", cursor:"pointer", fontSize:12, marginTop:4 }}>
                Clear history
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
