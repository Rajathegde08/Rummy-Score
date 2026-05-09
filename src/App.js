import { useState, useRef } from "react";

const COLORS = ["#FF6B6B","#4ECDC4","#FFD93D","#6BCB77","#845EC2","#FF9671","#00B4D8","#F72585","#90BE6D","#F9844A"];
const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

const VARIANTS = {
  points: { name:"Points Rummy", bust: 0, description:"Classic — lowest score wins. Set a bust limit.", hasBust: true },
  pool101: { name:"Pool 101", bust: 101, description:"Player is eliminated at 101 points.", hasBust: false },
  pool201: { name:"Pool 201", bust: 201, description:"Player is eliminated at 201 points.", hasBust: false },
  deals: { name:"Deals Rummy", bust: 0, description:"Fixed number of deals. Lowest total wins.", hasBust: false },
};

// ── Sound ──────────────────────────────────────────────
function useSound() {
  const ctx = useRef(null);
  const getCtx = () => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.current;
  };
  const playBust = () => {
    try {
      const c = getCtx(); const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth";
      o.frequency.setValueAtTime(300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, c.currentTime+0.4);
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.4);
      o.start(); o.stop(c.currentTime+0.4);
    } catch(e){}
  };
  const playWin = () => {
    try {
      const c = getCtx();
      [523,659,784,1047].forEach((freq,i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = freq;
        const t = c.currentTime+i*0.12;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.25,t+0.05);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
        o.start(t); o.stop(t+0.3);
      });
    } catch(e){}
  };
  const playTick = () => {
    try {
      const c = getCtx(); const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 440;
      g.gain.setValueAtTime(0.08,c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);
      o.start(); o.stop(c.currentTime+0.1);
    } catch(e){}
  };
  return { playBust, playWin, playTick };
}

// ── Net settlement calculator ──────────────────────────
function calcSettlements(players, totals, ratePerPoint, rateType, targetScore) {
  const n = players.length;
  let balances = {};
  players.forEach(p => { balances[p.id] = 0; });

  if (rateType === "per_point") {
    // Each player's cost = their score × rate
    // Winner (lowest score) gets the pot
    const winner = [...players].sort((a,b) => totals[a.id]-totals[b.id])[0];
    players.forEach(p => {
      if (p.id !== winner.id) {
        const amount = totals[p.id] * ratePerPoint;
        balances[p.id] -= amount;
        balances[winner.id] += amount;
      }
    });
  } else if (rateType === "fixed") {
    // Loser pays fixed amount, winner gets it all
    const winner = [...players].sort((a,b) => totals[a.id]-totals[b.id])[0];
    players.forEach(p => {
      if (p.id !== winner.id) {
        balances[p.id] -= ratePerPoint;
        balances[winner.id] += ratePerPoint;
      }
    });
  } else if (rateType === "diff") {
    // Each player settles difference with winner
    const winner = [...players].sort((a,b) => totals[a.id]-totals[b.id])[0];
    players.forEach(p => {
      if (p.id !== winner.id) {
        const diff = (totals[p.id] - totals[winner.id]) * ratePerPoint;
        balances[p.id] -= diff;
        balances[winner.id] += diff;
      }
    });
  }

  // Convert balances to net settlements (who pays whom)
  const settlements = [];
  const bal = { ...balances };
  const payers = players.filter(p => bal[p.id] < 0).sort((a,b) => bal[a.id]-bal[b.id]);
  const receivers = players.filter(p => bal[p.id] > 0).sort((a,b) => bal[b.id]-bal[a.id]);

  let i = 0, j = 0;
  while (i < payers.length && j < receivers.length) {
    const payer = payers[i]; const receiver = receivers[j];
    const amount = Math.min(-bal[payer.id], bal[receiver.id]);
    if (amount > 0) {
      settlements.push({ from: payer.name, to: receiver.name, amount: Math.round(amount) });
    }
    bal[payer.id] += amount; bal[receiver.id] -= amount;
    if (Math.abs(bal[payer.id]) < 0.01) i++;
    if (Math.abs(bal[receiver.id]) < 0.01) j++;
  }
  return settlements;
}

// ── Modal ──────────────────────────────────────────────
function Modal({ title, children, onClose, T }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, overflowY:"auto" }}>
      <div style={{ background:T.surface, borderRadius:20, padding:28, width:"100%", maxWidth:420, color:T.text, border:`1px solid ${T.border}`, margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState("setup");
  const [players, setPlayers] = useState([{ name:"", id:0 }, { name:"", id:1 }]);
  const [variant, setVariant] = useState("points");
  const [targetScore, setTargetScore] = useState(200);
  const [dealCount, setDealCount] = useState(3);
  const [currentDeal, setCurrentDeal] = useState(1);

  // Stakes
  const [stakesEnabled, setStakesEnabled] = useState(false);
  const [rateType, setRateType] = useState("per_point");
  const [rateValue, setRateValue] = useState(1);

  const [rounds, setRounds] = useState([]);
  const [currentInput, setCurrentInput] = useState({});
  const [bustedPlayers, setBustedPlayers] = useState(new Set());
  const [reentryModal, setReentryModal] = useState(null);
  const [reentryScore, setReentryScore] = useState("");
  const [confetti, setConfetti] = useState([]);
  const [endModal, setEndModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [leaderboardModal, setLeaderboardModal] = useState(false);
  const [stakesModal, setStakesModal] = useState(false);

  const [gameHistory, setGameHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rummy_v3_history") || "[]"); } catch { return []; }
  });

  const sound = useSound();

  const T = {
    bg:       dark ? "#0f0f0f" : "#f5f3ee",
    surface:  dark ? "#1a1a1a" : "#ffffff",
    surface2: dark ? "#111111" : "#f0ede8",
    border:   dark ? "#2a2a2a" : "#e0ddd8",
    text:     dark ? "#f0ece0" : "#1a1a1a",
    muted:    dark ? "#555555" : "#999999",
    muted2:   dark ? "#888888" : "#666666",
  };

  const variantObj = VARIANTS[variant];
  const effectiveBust = variantObj.hasBust ? targetScore : variantObj.bust || 999;

  const addPlayer = () => { if (players.length < 10) setPlayers([...players, { name:"", id:Date.now() }]); };
  const removePlayer = (id) => { if (players.length > 2) setPlayers(players.filter(p => p.id !== id)); };
  const updateName = (id, name) => setPlayers(players.map(p => p.id === id ? { ...p, name } : p));

  const startGame = () => {
    const named = players.map((p,i) => ({ ...p, name: p.name.trim() || `Player ${i+1}` }));
    setPlayers(named);
    const init = {};
    named.forEach(p => { init[p.id] = ""; });
    setCurrentInput(init); setScreen("game"); setCurrentDeal(1);
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
    const newlyBusted = activePlayers.filter(p => newTotals[p.id] >= effectiveBust && effectiveBust < 999);
    if (newlyBusted.length > 0) {
      setTimeout(() => sound.playBust(), 100);
      const newBusted = new Set(bustedPlayers);
      newlyBusted.forEach(p => newBusted.add(p.id));
      setBustedPlayers(newBusted);
    }

    // Deals rummy — auto advance deal
    if (variant === "deals") {
      if (currentDeal >= dealCount) {
        setTimeout(() => { sound.playWin(); shootConfetti(); saveToHistory(newTotals); setEndModal(true); }, 300);
      } else {
        setCurrentDeal(d => d + 1);
      }
    }

    const reset = {};
    players.forEach(p => { reset[p.id] = ""; });
    setCurrentInput(reset);
  };

  const openReentry = (id) => { setReentryModal(id); setReentryScore(""); };
  const confirmReentry = () => {
    const val = parseInt(reentryScore);
    if (isNaN(val) || val < 0) return;
    const currentTotals = getTotals();
    const delta = val - currentTotals[reentryModal];
    const adjRound = {};
    players.forEach(p => { adjRound[p.id] = 0; });
    adjRound[reentryModal] = delta; adjRound.__reentry = reentryModal;
    setRounds(prev => [...prev, adjRound]);
    const nb = new Set(bustedPlayers); nb.delete(reentryModal);
    setBustedPlayers(nb); setReentryModal(null);
  };

  const shootConfetti = () => {
    const dots = Array.from({ length:60 }, (_,i) => ({ id:i, x:Math.random()*window.innerWidth, color:COLORS[Math.floor(Math.random()*COLORS.length)] }));
    setConfetti(dots); setTimeout(() => setConfetti([]), 1600);
  };

  const saveToHistory = (t) => {
    const sorted = [...players].sort((a,b) => t[a.id]-t[b.id]);
    const settlements = stakesEnabled ? calcSettlements(players, t, rateValue, rateType, effectiveBust) : [];
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }),
      time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }),
      players: players.map(p => ({ name:p.name, score:t[p.id], id:p.id })),
      winner: sorted[0].name,
      rounds: rounds.filter(r => !r.__reentry).length,
      variant: variantObj.name,
      settlements,
    };
    const newHistory = [entry, ...gameHistory].slice(0, 50);
    setGameHistory(newHistory);
    try { localStorage.setItem("rummy_v3_history", JSON.stringify(newHistory)); } catch(e) {}
  };

  const endGame = () => {
    sound.playWin(); shootConfetti();
    saveToHistory(getTotals());
    setEndModal(true);
  };

  const resetGame = () => {
    setRounds([]); setBustedPlayers(new Set()); setEndModal(false);
    setScreen("setup"); setPlayers([{ name:"", id:0 },{ name:"", id:1 }]);
    setCurrentInput({}); setCurrentDeal(1);
  };

  const deleteRound = (idx) => setRounds(rounds.filter((_,i) => i !== idx));
  const totals = getTotals();
  const sorted = [...players].sort((a,b) => totals[a.id]-totals[b.id]);
  const playerIndex = (id) => players.findIndex(p => p.id === id);

  // Leaderboard from history
  const leaderboard = () => {
    const stats = {};
    gameHistory.forEach(g => {
      g.players.forEach((p,i) => {
        if (!stats[p.name]) stats[p.name] = { name:p.name, games:0, wins:0, totalScore:0 };
        stats[p.name].games++;
        stats[p.name].totalScore += p.score;
        if (p.name === g.winner) stats[p.name].wins++;
      });
    });
    return Object.values(stats).sort((a,b) => b.wins-a.wins || a.totalScore-b.totalScore);
  };

  const shareText = (title) => {
    const t = getTotals();
    const lines = [...players].sort((a,b)=>t[a.id]-t[b.id])
      .map((p,i) => `${MEDALS[i]} ${p.name} — ${t[p.id]} pts${bustedPlayers.has(p.id)?" 💀":""}`)
      .join("\n");
    let msg = `🃏 *${title}* (${variantObj.name})\n\n${lines}`;
    if (stakesEnabled) {
      const s = calcSettlements(players, t, rateValue, rateType, effectiveBust);
      if (s.length > 0) {
        msg += "\n\n💰 *Settlements:*\n" + s.map(x => `${x.from} → ${x.to}: ₹${x.amount}`).join("\n");
      }
    }
    msg += `\n\nhttps://rummyscoretrack.netlify.app`;
    return msg;
  };

  const share = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

  const iconBtn = (label, onClick, bg="#1a1a1a") => (
    <button onClick={onClick} style={{ background:bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 11px", color:bg==="#1a1a1a"?T.muted2:"#fff", cursor:"pointer", fontSize:13, fontFamily:"Georgia,serif" }}>{label}</button>
  );

  return (
    <div style={{ fontFamily:"Georgia, serif", minHeight:"100vh", background:T.bg, color:T.text, transition:"background 0.25s" }}>
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

      {/* ════════════ SETUP ════════════ */}
      {screen === "setup" && (
        <div style={{ maxWidth:460, margin:"0 auto", padding:"24px 18px" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
            <div>
              <div style={{ fontSize:32, marginBottom:3 }}>
                {["♠","♥","♦","♣"].map((s,i) => <span key={i} style={{ color:i%2===0?T.text:"#FF6B6B", marginRight:2 }}>{s}</span>)}
              </div>
              <h1 style={{ fontSize:20, margin:0, letterSpacing:3, fontWeight:700 }}>RUMMY SCORE</h1>
              <p style={{ color:T.muted, marginTop:3, fontSize:11 }}>v3 — No pen. No paper.</p>
            </div>
            <div style={{ display:"flex", gap:7 }}>
              <button onClick={() => setLeaderboardModal(true)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 11px", color:T.muted2, cursor:"pointer", fontSize:13 }}>🏆</button>
              <button onClick={() => setHistoryModal(true)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 11px", color:T.muted2, cursor:"pointer", fontSize:13 }}>📊</button>
              <button onClick={() => setDark(!dark)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 11px", color:T.muted2, cursor:"pointer", fontSize:15 }}>{dark?"☀️":"🌙"}</button>
            </div>
          </div>

          {/* Variant picker */}
          <div style={{ background:T.surface, borderRadius:16, padding:20, marginBottom:14, border:`1px solid ${T.border}` }}>
            <label style={{ fontSize:11, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Game Variant</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
              {Object.entries(VARIANTS).map(([key, v]) => (
                <button key={key} onClick={() => { setVariant(key); if(key==="pool101") setTargetScore(101); if(key==="pool201") setTargetScore(201); }}
                  style={{ padding:"10px 8px", borderRadius:10, border:"none", cursor:"pointer", background:variant===key?"#FFD93D":T.surface2, color:variant===key?"#111":T.muted2, fontWeight:variant===key?700:400, fontSize:13, textAlign:"left" }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{v.name}</div>
                  <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>{v.description}</div>
                </button>
              ))}
            </div>
            {variant === "points" && (
              <div style={{ marginTop:12 }}>
                <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:8 }}>Bust limit</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {[100,200,300,500].map(v => (
                    <button key={v} onClick={() => setTargetScore(v)} style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", background:targetScore===v?"#FFD93D":T.surface2, color:targetScore===v?"#111":T.muted2, fontWeight:600, fontSize:13 }}>{v}</button>
                  ))}
                  <input type="number" value={targetScore} onChange={e => setTargetScore(Number(e.target.value))}
                    style={{ width:70, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 10px", color:T.text, fontSize:13 }} />
                </div>
              </div>
            )}
            {variant === "deals" && (
              <div style={{ marginTop:12 }}>
                <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:8 }}>Number of deals</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[2,3,5,6].map(v => (
                    <button key={v} onClick={() => setDealCount(v)} style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", background:dealCount===v?"#FFD93D":T.surface2, color:dealCount===v?"#111":T.muted2, fontWeight:600, fontSize:13 }}>{v}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Players */}
          <div style={{ background:T.surface, borderRadius:16, padding:20, marginBottom:14, border:`1px solid ${T.border}` }}>
            <label style={{ fontSize:11, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Players ({players.length}/10)</label>
            {players.map((p,i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(p.name[0]||(i+1)).toString().toUpperCase()}
                </div>
                <input value={p.name} onChange={e => updateName(p.id, e.target.value)} placeholder={`Player ${i+1}`}
                  style={{ flex:1, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", color:T.text, fontSize:15 }} />
                {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20, padding:4 }}>×</button>}
              </div>
            ))}
            {players.length < 10 && (
              <button onClick={addPlayer} style={{ width:"100%", marginTop:10, padding:9, background:T.surface2, border:`1px dashed ${T.border}`, borderRadius:8, color:T.muted, cursor:"pointer", fontSize:14 }}>+ Add Player</button>
            )}
          </div>

          {/* Stakes */}
          <div style={{ background:T.surface, borderRadius:16, padding:20, marginBottom:20, border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <label style={{ fontSize:11, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>💰 Stakes</label>
                <p style={{ fontSize:12, color:T.muted, margin:"3px 0 0", fontStyle:"italic" }}>Track who owes whom</p>
              </div>
              <button onClick={() => setStakesEnabled(!stakesEnabled)} style={{ background:stakesEnabled?"#FFD93D":T.surface2, border:`1px solid ${T.border}`, borderRadius:20, padding:"6px 16px", color:stakesEnabled?"#111":T.muted2, cursor:"pointer", fontSize:12, fontWeight:700 }}>
                {stakesEnabled ? "ON ✓" : "OFF"}
              </button>
            </div>
            {stakesEnabled && (
              <div style={{ marginTop:14 }}>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {[["per_point","₹ per point"],["fixed","Fixed per game"],["diff","Diff × rate"]].map(([k,l]) => (
                    <button key={k} onClick={() => setRateType(k)} style={{ flex:1, padding:"7px 4px", borderRadius:8, border:"none", cursor:"pointer", background:rateType===k?"#FFD93D":T.surface2, color:rateType===k?"#111":T.muted2, fontSize:11, fontWeight:rateType===k?700:400 }}>{l}</button>
                  ))}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18, color:"#FFD93D" }}>₹</span>
                  <input type="number" value={rateValue} onChange={e => setRateValue(Number(e.target.value))} min="0"
                    style={{ flex:1, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", color:T.text, fontSize:18, fontFamily:"Georgia,serif" }} />
                  <span style={{ fontSize:12, color:T.muted }}>
                    {rateType==="per_point"?"per point":rateType==="fixed"?"per game":"per pt diff"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button onClick={startGame} style={{ width:"100%", padding:16, background:"#FFD93D", border:"none", borderRadius:12, fontSize:17, fontWeight:700, color:"#111", cursor:"pointer", letterSpacing:1 }}>
            Start Game →
          </button>
        </div>
      )}

      {/* ════════════ GAME ════════════ */}
      {screen === "game" && (
        <div style={{ maxWidth:640, margin:"0 auto", padding:"16px 14px 48px" }}>

          {/* Top bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <h2 style={{ margin:0, fontSize:17, letterSpacing:1 }}>
                {variant==="deals" ? `🃏 Deal ${currentDeal}/${dealCount}` : `♣ Round ${rounds.filter(r=>!r.__reentry).length+1}`}
              </h2>
              <p style={{ margin:0, color:T.muted, fontSize:11 }}>
                {variantObj.name} · {effectiveBust<999?`Bust at ${effectiveBust}`:"No bust"} · {activePlayers.length} active
              </p>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {stakesEnabled && <button onClick={() => setStakesModal(true)} style={{ background:"#1a3a1a", border:"1px solid #2a5a2a", borderRadius:8, padding:"6px 10px", color:"#6BCB77", cursor:"pointer", fontSize:12 }}>💰</button>}
              <button onClick={() => share(shareText(`Rummy — Round ${rounds.filter(r=>!r.__reentry).length}`))} style={{ background:"#25D366", border:"none", borderRadius:8, padding:"6px 10px", color:"#fff", cursor:"pointer", fontSize:13 }}>📱</button>
              <button onClick={() => setDark(!dark)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 9px", color:T.muted2, cursor:"pointer", fontSize:13 }}>{dark?"☀️":"🌙"}</button>
              <button onClick={endGame} style={{ background:"#FFD93D", border:"none", borderRadius:8, padding:"6px 11px", color:"#111", cursor:"pointer", fontSize:13, fontWeight:700 }}>End</button>
              <button onClick={resetGame} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 9px", color:T.muted, cursor:"pointer", fontSize:13 }}>↺</button>
            </div>
          </div>

          {/* Scoreboard */}
          <div style={{ overflowX:"auto", marginBottom:14 }}>
            <div style={{ minWidth: players.length>5 ? players.length*72+56 : "auto" }}>
              <div style={{ background:T.surface, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}` }}>
                {/* Headers */}
                <div style={{ display:"grid", gridTemplateColumns:`48px repeat(${players.length}, 1fr)`, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ padding:"9px 8px", fontSize:10, color:T.muted, textTransform:"uppercase" }}>#</div>
                  {players.map((p,i) => {
                    const busted = bustedPlayers.has(p.id);
                    return (
                      <div key={p.id} style={{ padding:"7px 4px", textAlign:"center", opacity:busted?0.4:1 }}>
                        <div style={{ width:24, height:24, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", margin:"0 auto 2px", position:"relative" }}>
                          {p.name[0]?.toUpperCase()||(i+1)}
                          {busted && <span style={{ position:"absolute", top:-2, right:-2, fontSize:7, background:"#FF6B6B", borderRadius:"50%", width:11, height:11, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>✕</span>}
                        </div>
                        <div style={{ fontSize:9, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:52 }}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Round rows */}
                {rounds.map((r,idx) => {
                  const isReentry = !!r.__reentry;
                  const roundNum = rounds.slice(0,idx+1).filter(x=>!x.__reentry).length;
                  return (
                    <div key={idx} className="row-anim" style={{ display:"grid", gridTemplateColumns:`48px repeat(${players.length}, 1fr)`, borderBottom:`1px solid ${T.border}`, alignItems:"center", background:isReentry?(dark?"#181200":"#fffbe6"):"transparent" }}>
                      <div style={{ padding:"6px 8px", fontSize:10, display:"flex", alignItems:"center", gap:3 }}>
                        <span style={{ color:isReentry?"#FFD93D":T.muted }}>{isReentry?"↩":("#"+roundNum)}</span>
                        <button onClick={() => deleteRound(idx)} style={{ background:"none", border:"none", color:T.border, cursor:"pointer", fontSize:12, padding:0 }}>×</button>
                      </div>
                      {players.map((p,i) => {
                        const val = r[p.id] ?? 0; const isRe = isReentry && r.__reentry===p.id;
                        return (
                          <div key={p.id} style={{ padding:"6px 4px", textAlign:"center", fontSize:12, color:isRe?"#FFD93D":val===0&&!isReentry?COLORS[i%COLORS.length]:T.muted2, fontWeight:(isRe||val===0)?700:400 }}>
                            {isRe?(val>=0?`+${val}`:val):val===0&&!isReentry?"WIN":val===0&&bustedPlayers.has(p.id)?"—":val}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Totals */}
                <div style={{ display:"grid", gridTemplateColumns:`48px repeat(${players.length}, 1fr)`, background:T.surface2, borderTop:`2px solid ${T.border}` }}>
                  <div style={{ padding:"9px 8px", fontSize:10, color:T.muted, textTransform:"uppercase" }}>Total</div>
                  {players.map((p,i) => {
                    const t = totals[p.id]; const busted = bustedPlayers.has(p.id); const pct = effectiveBust<999?Math.min((t/effectiveBust)*100,100):0;
                    return (
                      <div key={p.id} style={{ padding:"7px 4px", textAlign:"center", opacity:busted?0.5:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:busted?"#FF6B6B":t>effectiveBust*0.8?"#FFB347":T.text }}>{t}</div>
                        {busted && <div style={{ fontSize:7, color:"#FF6B6B", marginTop:1 }}>BUSTED</div>}
                        {effectiveBust<999 && <div style={{ height:3, background:T.border, borderRadius:2, margin:"3px 6px 0", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:busted?"#FF6B6B":COLORS[i%COLORS.length], borderRadius:2, transition:"width 0.4s" }}/>
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Busted */}
          {bustedPlayers.size > 0 && (
            <div style={{ background:dark?"#160808":"#fff5f5", border:"1px solid #3a1515", borderRadius:12, padding:14, marginBottom:12 }}>
              <p style={{ margin:"0 0 10px", fontSize:11, color:"#FF6B6B", textTransform:"uppercase", letterSpacing:1 }}>💀 Busted — tap to re-enter</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {[...bustedPlayers].map(id => {
                  const p = players.find(x=>x.id===id); const pi = playerIndex(id);
                  return (
                    <div key={id} style={{ display:"flex", alignItems:"center", gap:8, background:T.surface2, borderRadius:10, padding:"7px 11px" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff" }}>{p?.name[0]?.toUpperCase()}</div>
                      <span style={{ fontSize:12, color:T.muted2 }}>{p?.name}</span>
                      <span style={{ fontSize:11, color:"#FF6B6B", fontWeight:700 }}>{totals[id]}</span>
                      <button onClick={() => openReentry(id)} style={{ background:"#FFD93D", border:"none", borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700, color:"#111", cursor:"pointer" }}>Re-enter</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score entry */}
          {activePlayers.length > 0 ? (
            <div style={{ background:T.surface, borderRadius:16, padding:16, border:`1px solid ${T.border}` }}>
              <p style={{ margin:"0 0 12px", fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>
                {variant==="deals" ? `Scores — Deal ${currentDeal}` : `Scores — Round ${rounds.filter(r=>!r.__reentry).length+1}`}
              </p>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(activePlayers.length,3)}, 1fr)`, gap:10, marginBottom:10 }}>
                {activePlayers.map(p => {
                  const i = playerIndex(p.id);
                  return (
                    <div key={p.id}>
                      <label style={{ fontSize:11, color:COLORS[i%COLORS.length], display:"block", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</label>
                      <input type="number" value={currentInput[p.id]??""} onChange={e => setCurrentInput({...currentInput,[p.id]:e.target.value})}
                        placeholder="0" min="0"
                        style={{ width:"100%", background:T.surface2, border:`1.5px solid ${COLORS[i%COLORS.length]}55`, borderRadius:10, padding:"11px 8px", color:T.text, fontSize:20, textAlign:"center", fontFamily:"Georgia,serif" }} />
                    </div>
                  );
                })}
              </div>
              <p style={{ margin:"0 0 10px", fontSize:11, color:T.muted, textAlign:"center" }}>Enter 0 for the round winner</p>
              <button onClick={addRound} style={{ width:"100%", padding:13, background:"#FFD93D", border:"none", borderRadius:10, fontSize:16, fontWeight:700, color:"#111", cursor:"pointer" }}>
                {variant==="deals" ? (currentDeal>=dealCount?"Finish Game ✓":"Next Deal →") : "Add Round ＋"}
              </button>
            </div>
          ) : (
            <div style={{ background:T.surface, borderRadius:16, padding:22, textAlign:"center", border:`1px solid ${T.border}` }}>
              <p style={{ color:"#FF6B6B", fontSize:15, margin:0 }}>All players busted!</p>
              <p style={{ color:T.muted, fontSize:13, marginTop:6 }}>Re-enter players above or end the game.</p>
            </div>
          )}

          {/* Standings */}
          {rounds.length > 0 && (
            <div style={{ marginTop:12, background:T.surface, borderRadius:16, padding:16, border:`1px solid ${T.border}` }}>
              <p style={{ margin:"0 0 10px", fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Standings</p>
              {sorted.map((p,rank) => {
                const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, opacity:busted?0.45:1 }}>
                    <span style={{ fontSize:14, width:20 }}>{MEDALS[rank]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:13 }}>{p.name}{busted?" 💀":""}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:busted?"#FF6B6B":totals[p.id]>effectiveBust*0.8&&effectiveBust<999?"#FFB347":T.text }}>{totals[p.id]}</span>
                      </div>
                      {effectiveBust<999 && <div style={{ height:3, background:T.border, borderRadius:2, marginTop:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.min((totals[p.id]/effectiveBust)*100,100)}%`, background:busted?"#FF6B6B":COLORS[pi%COLORS.length], borderRadius:2, transition:"width 0.4s" }}/>
                      </div>}
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
          <p style={{ color:T.muted2, fontSize:13, margin:"0 0 14px" }}>Current: <strong style={{ color:"#FF6B6B" }}>{totals[reentryModal]} pts</strong> — Enter agreed re-entry score:</p>
          <input type="number" value={reentryScore} onChange={e => setReentryScore(e.target.value)} placeholder={`e.g. ${effectiveBust-20}`} autoFocus
            style={{ width:"100%", background:T.surface2, border:"1.5px solid #FFD93D", borderRadius:10, padding:"13px 12px", color:T.text, fontSize:22, textAlign:"center", fontFamily:"Georgia,serif", marginBottom:14 }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setReentryModal(null)} style={{ flex:1, padding:11, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, color:T.muted2, cursor:"pointer" }}>Cancel</button>
            <button onClick={confirmReentry} style={{ flex:1, padding:11, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer" }}>Confirm ↩</button>
          </div>
        </Modal>
      )}

      {/* ════ END GAME MODAL ════ */}
      {endModal && (() => {
        const t = getTotals();
        const finalSorted = [...players].sort((a,b) => t[a.id]-t[b.id]);
        const settlements = stakesEnabled ? calcSettlements(players, t, rateValue, rateType, effectiveBust) : [];
        return (
          <Modal title="🏆 Game Over" onClose={() => setEndModal(false)} T={T}>
            <p style={{ color:T.muted2, fontSize:13, margin:"0 0 14px" }}>Final standings — lowest score wins!</p>
            {finalSorted.map((p,rank) => {
              const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
              return (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:9, padding:"10px 14px", background:rank===0?(dark?"#1f1a00":"#fffbe6"):T.surface2, borderRadius:10, border:rank===0?"1px solid #FFD93D44":`1px solid ${T.border}` }}>
                  <span style={{ fontSize:17 }}>{MEDALS[rank]}</span>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>{p.name[0]?.toUpperCase()}</div>
                  <span style={{ flex:1, fontSize:14 }}>{p.name}{busted?" 💀":""}</span>
                  <span style={{ fontSize:15, fontWeight:700, color:rank===0?"#FFD93D":busted?"#FF6B6B":T.text }}>{t[p.id]}</span>
                </div>
              );
            })}

            {/* Stakes settlements */}
            {stakesEnabled && settlements.length > 0 && (
              <div style={{ background:dark?"#0a1a0a":"#f0fff0", border:"1px solid #1a4a1a", borderRadius:12, padding:14, margin:"14px 0" }}>
                <p style={{ margin:"0 0 10px", fontSize:11, color:"#6BCB77", textTransform:"uppercase", letterSpacing:1 }}>💰 Who pays whom</p>
                {settlements.map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:i<settlements.length-1?`1px solid ${T.border}`:"none" }}>
                    <span style={{ fontSize:13, color:T.text }}>{s.from} → {s.to}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:"#6BCB77" }}>₹{s.amount}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => share(shareText("Rummy Game Over!"))} style={{ width:"100%", padding:12, background:"#25D366", border:"none", borderRadius:10, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14, marginBottom:10 }}>
              📱 Share on WhatsApp
            </button>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setEndModal(false); setRounds([]); setBustedPlayers(new Set()); setCurrentDeal(1); const init={}; players.forEach(p=>{init[p.id]="";}); setCurrentInput(init); }}
                style={{ flex:1, padding:11, background:T.surface2, border:`1px solid ${T.border}`, borderRadius:10, color:T.muted2, cursor:"pointer", fontSize:14 }}>Rematch ↺</button>
              <button onClick={resetGame} style={{ flex:1, padding:11, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer", fontSize:14 }}>New Game →</button>
            </div>
          </Modal>
        );
      })()}

      {/* ════ STAKES MODAL (mid-game) ════ */}
      {stakesModal && (() => {
        const settlements = calcSettlements(players, totals, rateValue, rateType, effectiveBust);
        return (
          <Modal title="💰 Current Stakes" onClose={() => setStakesModal(false)} T={T}>
            <p style={{ color:T.muted2, fontSize:13, margin:"0 0 14px", fontStyle:"italic" }}>Based on current scores — final at end of game.</p>
            {sorted.map((p,rank) => (
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:13 }}>{MEDALS[rank]} {p.name}</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{totals[p.id]} pts</span>
              </div>
            ))}
            {settlements.length > 0 && (
              <div style={{ marginTop:14 }}>
                <p style={{ fontSize:11, color:"#6BCB77", textTransform:"uppercase", letterSpacing:1, margin:"0 0 10px" }}>Settlements if game ended now</p>
                {settlements.map((s,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<settlements.length-1?`1px solid ${T.border}`:"none" }}>
                    <span style={{ fontSize:13 }}>{s.from} → {s.to}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:"#6BCB77" }}>₹{s.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* ════ HISTORY MODAL ════ */}
      {historyModal && (
        <Modal title="📊 Game History" onClose={() => setHistoryModal(false)} T={T}>
          {gameHistory.length === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:T.muted }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🃏</div>
              <p style={{ fontSize:14 }}>No games yet — play one!</p>
            </div>
          ) : (
            <div style={{ maxHeight:440, overflowY:"auto" }}>
              {gameHistory.map(g => (
                <div key={g.id} style={{ background:T.surface2, borderRadius:12, padding:14, marginBottom:10, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>🏆 {g.winner}</span>
                    <span style={{ fontSize:11, color:T.muted }}>{g.date} · {g.rounds}R</span>
                  </div>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:6 }}>{g.variant}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {[...g.players].sort((a,b)=>a.score-b.score).map((p,i) => (
                      <span key={p.id} style={{ fontSize:12, color:i===0?"#FFD93D":T.muted2 }}>{MEDALS[i]} {p.name} {p.score}</span>
                    ))}
                  </div>
                  {g.settlements && g.settlements.length > 0 && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                      {g.settlements.map((s,i) => (
                        <div key={i} style={{ fontSize:11, color:"#6BCB77" }}>{s.from} → {s.to}: ₹{s.amount}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => { if(window.confirm("Clear all history?")) { setGameHistory([]); try{localStorage.removeItem("rummy_v3_history");}catch(e){} }}}
                style={{ width:"100%", padding:9, background:"none", border:`1px solid #FF6B6B44`, borderRadius:8, color:"#FF6B6B", cursor:"pointer", fontSize:12, marginTop:4 }}>
                Clear history
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ════ LEADERBOARD MODAL ════ */}
      {leaderboardModal && (() => {
        const lb = leaderboard();
        return (
          <Modal title="🏆 All-Time Leaderboard" onClose={() => setLeaderboardModal(false)} T={T}>
            {lb.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:T.muted }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🏆</div>
                <p style={{ fontSize:14 }}>Play some games first!</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, padding:"6px 4px", marginBottom:6 }}>
                  <span style={{ fontSize:10, color:T.muted, textTransform:"uppercase" }}>Player</span>
                  <span style={{ fontSize:10, color:T.muted, textTransform:"uppercase" }}>Games</span>
                  <span style={{ fontSize:10, color:T.muted, textTransform:"uppercase" }}>Wins</span>
                  <span style={{ fontSize:10, color:T.muted, textTransform:"uppercase" }}>Avg</span>
                </div>
                {lb.map((p,i) => (
                  <div key={p.name} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, padding:"10px 4px", borderBottom:`1px solid ${T.border}`, alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:15 }}>{MEDALS[i]}</span>
                      <span style={{ fontSize:14, color:i===0?"#FFD93D":T.text, fontWeight:i===0?700:400 }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize:13, color:T.muted2, textAlign:"center" }}>{p.games}</span>
                    <span style={{ fontSize:13, color:"#6BCB77", textAlign:"center", fontWeight:700 }}>{p.wins}</span>
                    <span style={{ fontSize:13, color:T.muted2, textAlign:"center" }}>{Math.round(p.totalScore/p.games)}</span>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
