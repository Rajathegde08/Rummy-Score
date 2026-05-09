import { useState } from "react";

const COLORS = [
  "#FF6B6B","#4ECDC4","#FFD93D","#6BCB77",
  "#845EC2","#FF9671","#00B4D8","#F72585",
  "#90BE6D","#F9844A",
];

const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#1a1a1a", borderRadius:20, padding:28, width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, color:"#f0ece0" }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#777", fontSize:22, cursor:"pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function RummyTracker() {
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
    const newRounds = [...rounds, round];
    setRounds(newRounds);
    const newTotals = getTotals(newRounds);
    const newlyBusted = activePlayers.filter(p => newTotals[p.id] >= targetScore);
    if (newlyBusted.length > 0) {
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
    const dots = Array.from({ length:50 }, (_, i) => ({ id:i, x:Math.random()*window.innerWidth, color:COLORS[Math.floor(Math.random()*COLORS.length)] }));
    setConfetti(dots);
    setTimeout(() => setConfetti([]), 1400);
  };

  const endGame = () => { shootConfetti(); setEndModal(true); };

  const resetGame = () => {
    setRounds([]); setBustedPlayers(new Set()); setEndModal(false);
    setScreen("setup"); setPlayers([{ name:"", id:0 },{ name:"", id:1 }]);
    setCurrentInput({}); setTargetScore(200);
  };

  const deleteRound = (idx) => setRounds(rounds.filter((_, i) => i !== idx));
  const totals = getTotals();
  const sorted = [...players].sort((a, b) => totals[a.id] - totals[b.id]);
  const playerIndex = (id) => players.findIndex(p => p.id === id);

  return (
    <div style={{ fontFamily:"'Georgia', serif", minHeight:"100vh", background:"#0f0f0f", color:"#f0ece0" }}>
      <style>{`
        @keyframes fall { to { transform:translateY(105vh) rotate(720deg); opacity:0; } }
        @keyframes slideUp { from { transform:translateY(14px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        .row-anim { animation:slideUp 0.22s ease forwards; }
        input:focus { outline:none; border-color:#FFD93D !important; }
        input::placeholder { color:#444; }
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
      `}</style>

      {confetti.map(d => (
        <div key={d.id} style={{ position:"fixed", left:d.x, top:-10, width:8, height:8, borderRadius:"50%", background:d.color, pointerEvents:"none", animation:"fall 1.2s ease-out forwards", zIndex:9999 }}/>
      ))}

      {screen === "setup" && (
        <div style={{ maxWidth:460, margin:"0 auto", padding:"36px 18px" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontSize:44, marginBottom:6 }}>{"♠♥♦♣".split("").map((s,i)=><span key={i} style={{ color:i%2===0?"#f0ece0":"#FF6B6B", marginRight:2 }}>{s}</span>)}</div>
            <h1 style={{ fontSize:28, margin:0, letterSpacing:3, fontWeight:700 }}>RUMMY SCORE</h1>
            <p style={{ color:"#555", marginTop:6, fontSize:13 }}>No pen. No paper. Just play.</p>
          </div>
          <div style={{ background:"#1a1a1a", borderRadius:16, padding:22, marginBottom:16 }}>
            <label style={{ fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase" }}>Players ({players.length}/10)</label>
            {players.map((p, i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginTop:11 }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(p.name[0]||(i+1)).toString().toUpperCase()}
                </div>
                <input value={p.name} onChange={e => updateName(p.id, e.target.value)} placeholder={`Player ${i+1}`}
                  style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#f0ece0", fontSize:15 }} />
                {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:20, padding:4 }}>×</button>}
              </div>
            ))}
            {players.length < 10 && (
              <button onClick={addPlayer} style={{ width:"100%", marginTop:12, padding:10, background:"#111", border:"1px dashed #2a2a2a", borderRadius:8, color:"#555", cursor:"pointer", fontSize:14 }}>+ Add Player</button>
            )}
          </div>
          <div style={{ background:"#1a1a1a", borderRadius:16, padding:22, marginBottom:22 }}>
            <label style={{ fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase" }}>Bust Limit</label>
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              {[100,200,300,500].map(v => (
                <button key={v} onClick={() => setTargetScore(v)} style={{ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", background:targetScore===v?"#FFD93D":"#111", color:targetScore===v?"#111":"#888", fontWeight:600, fontSize:14 }}>{v}</button>
              ))}
              <input type="number" value={targetScore} onChange={e => setTargetScore(Number(e.target.value))}
                style={{ width:80, background:"#111", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 12px", color:"#f0ece0", fontSize:14 }} />
            </div>
          </div>
          <button onClick={startGame} style={{ width:"100%", padding:16, background:"#FFD93D", border:"none", borderRadius:12, fontSize:17, fontWeight:700, color:"#111", cursor:"pointer", letterSpacing:1 }}>Start Game →</button>
        </div>
      )}

      {screen === "game" && (
        <div style={{ maxWidth:620, margin:"0 auto", padding:"18px 14px 48px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <h2 style={{ margin:0, fontSize:19, letterSpacing:1 }}>♣ Round {rounds.filter(r=>!r.__reentry).length + 1}</h2>
              <p style={{ margin:0, color:"#555", fontSize:12 }}>Bust at {targetScore} · {activePlayers.length} active · {bustedPlayers.size} busted</p>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={endGame} style={{ background:"#FFD93D", border:"none", borderRadius:8, padding:"7px 14px", color:"#111", cursor:"pointer", fontSize:13, fontWeight:700 }}>End Game</button>
              <button onClick={resetGame} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:8, padding:"7px 12px", color:"#555", cursor:"pointer", fontSize:13 }}>Reset</button>
            </div>
          </div>

          <div style={{ overflowX:"auto", marginBottom:16 }}>
            <div style={{ minWidth: players.length > 5 ? players.length * 72 + 56 : "auto" }}>
              <div style={{ background:"#1a1a1a", borderRadius:16, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, borderBottom:"1px solid #222" }}>
                  <div style={{ padding:"10px 8px", fontSize:10, color:"#444", textTransform:"uppercase" }}>#</div>
                  {players.map((p, i) => {
                    const busted = bustedPlayers.has(p.id);
                    return (
                      <div key={p.id} style={{ padding:"8px 4px", textAlign:"center", opacity:busted?0.4:1 }}>
                        <div style={{ width:26, height:26, borderRadius:"50%", background:COLORS[i%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", margin:"0 auto 2px", position:"relative" }}>
                          {p.name[0]?.toUpperCase()||(i+1)}
                          {busted && <span style={{ position:"absolute", top:-3, right:-3, fontSize:8, background:"#FF6B6B", borderRadius:"50%", width:13, height:13, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>✕</span>}
                        </div>
                        <div style={{ fontSize:10, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:54 }}>{p.name}</div>
                      </div>
                    );
                  })}
                </div>
                {rounds.map((r, idx) => {
                  const isReentry = !!r.__reentry;
                  const roundNum = rounds.slice(0,idx+1).filter(x=>!x.__reentry).length;
                  return (
                    <div key={idx} className="row-anim" style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, borderBottom:"1px solid #181818", alignItems:"center", background:isReentry?"#181200":"transparent" }}>
                      <div style={{ padding:"7px 8px", fontSize:10, display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ color:isReentry?"#FFD93D":"#444" }}>{isReentry?"↩":("#"+roundNum)}</span>
                        <button onClick={() => deleteRound(idx)} style={{ background:"none", border:"none", color:"#282828", cursor:"pointer", fontSize:13, padding:0 }}>×</button>
                      </div>
                      {players.map((p, i) => {
                        const val = r[p.id] ?? 0;
                        const isRe = isReentry && r.__reentry === p.id;
                        return (
                          <div key={p.id} style={{ padding:"7px 4px", textAlign:"center", fontSize:12, color:isRe?"#FFD93D":val===0&&!isReentry?COLORS[i%COLORS.length]:"#c0bcb4", fontWeight:(isRe||val===0)?700:400 }}>
                            {isRe?(val>=0?`+${val}`:val):val===0&&!isReentry?"WIN":val===0&&bustedPlayers.has(p.id)?"—":val}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div style={{ display:"grid", gridTemplateColumns:`50px repeat(${players.length}, 1fr)`, background:"#111", borderTop:"2px solid #2a2a2a" }}>
                  <div style={{ padding:"10px 8px", fontSize:10, color:"#444", textTransform:"uppercase" }}>Total</div>
                  {players.map((p, i) => {
                    const t = totals[p.id]; const busted = bustedPlayers.has(p.id); const pct = Math.min((t/targetScore)*100,100);
                    return (
                      <div key={p.id} style={{ padding:"8px 4px", textAlign:"center", opacity:busted?0.5:1 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:busted?"#FF6B6B":t>targetScore*0.8?"#FFB347":"#f0ece0" }}>{t}</div>
                        {busted && <div style={{ fontSize:8, color:"#FF6B6B", marginTop:1 }}>BUSTED</div>}
                        <div style={{ height:3, background:"#222", borderRadius:2, margin:"4px 6px 0", overflow:"hidden" }}>
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
            <div style={{ background:"#160808", border:"1px solid #3a1515", borderRadius:14, padding:16, marginBottom:14 }}>
              <p style={{ margin:"0 0 12px", fontSize:11, color:"#FF6B6B", textTransform:"uppercase", letterSpacing:1 }}>💀 Busted — tap to re-enter</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {[...bustedPlayers].map(id => {
                  const p = players.find(x => x.id === id); const pi = playerIndex(id);
                  return (
                    <div key={id} style={{ display:"flex", alignItems:"center", gap:8, background:"#111", borderRadius:10, padding:"8px 12px" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>{p?.name[0]?.toUpperCase()}</div>
                      <span style={{ fontSize:13, color:"#999" }}>{p?.name}</span>
                      <span style={{ fontSize:11, color:"#FF6B6B", fontWeight:700 }}>{totals[id]}</span>
                      <button onClick={() => openReentry(id)} style={{ background:"#FFD93D", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#111", cursor:"pointer" }}>Re-enter</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activePlayers.length > 0 ? (
            <div style={{ background:"#1a1a1a", borderRadius:16, padding:18 }}>
              <p style={{ margin:"0 0 14px", fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Enter scores — Round {rounds.filter(r=>!r.__reentry).length + 1}</p>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(activePlayers.length,3)}, 1fr)`, gap:10, marginBottom:12 }}>
                {activePlayers.map(p => {
                  const i = playerIndex(p.id);
                  return (
                    <div key={p.id}>
                      <label style={{ fontSize:11, color:COLORS[i%COLORS.length], display:"block", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</label>
                      <input type="number" value={currentInput[p.id] ?? ""} onChange={e => setCurrentInput({ ...currentInput, [p.id]: e.target.value })}
                        placeholder="0" min="0" style={{ width:"100%", background:"#111", border:`1.5px solid ${COLORS[i%COLORS.length]}55`, borderRadius:10, padding:"11px 8px", color:"#f0ece0", fontSize:20, textAlign:"center", fontFamily:"Georgia,serif" }} />
                    </div>
                  );
                })}
              </div>
              <p style={{ margin:"0 0 10px", fontSize:11, color:"#3a3a3a", textAlign:"center" }}>Enter 0 for the round winner</p>
              <button onClick={addRound} style={{ width:"100%", padding:14, background:"#FFD93D", border:"none", borderRadius:10, fontSize:16, fontWeight:700, color:"#111", cursor:"pointer" }}>Add Round ＋</button>
            </div>
          ) : (
            <div style={{ background:"#1a1a1a", borderRadius:16, padding:24, textAlign:"center" }}>
              <p style={{ color:"#FF6B6B", fontSize:15, margin:0 }}>All players busted!</p>
              <p style={{ color:"#444", fontSize:13, marginTop:6 }}>Re-enter players above or end the game.</p>
            </div>
          )}

          {rounds.length > 0 && (
            <div style={{ marginTop:14, background:"#1a1a1a", borderRadius:16, padding:18 }}>
              <p style={{ margin:"0 0 12px", fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Standings</p>
              {sorted.map((p, rank) => {
                const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9, opacity:busted?0.45:1 }}>
                    <span style={{ fontSize:15, width:22 }}>{MEDALS[rank]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:13 }}>{p.name}{busted?" 💀":""}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:busted?"#FF6B6B":totals[p.id]>targetScore*0.8?"#FFB347":"#f0ece0" }}>{totals[p.id]}</span>
                      </div>
                      <div style={{ height:3, background:"#222", borderRadius:2, marginTop:4, overflow:"hidden" }}>
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

      {reentryModal !== null && (
        <Modal title={`↩ Re-enter ${players.find(p=>p.id===reentryModal)?.name}`} onClose={() => setReentryModal(null)}>
          <p style={{ color:"#666", fontSize:13, margin:"0 0 4px" }}>Current score: <strong style={{ color:"#FF6B6B" }}>{totals[reentryModal]} pts</strong></p>
          <p style={{ color:"#666", fontSize:13, margin:"0 0 16px" }}>Enter the agreed re-entry score:</p>
          <input type="number" value={reentryScore} onChange={e => setReentryScore(e.target.value)} placeholder={`e.g. ${targetScore - 20}`} autoFocus
            style={{ width:"100%", background:"#111", border:"1.5px solid #FFD93D", borderRadius:10, padding:"14px 12px", color:"#f0ece0", fontSize:22, textAlign:"center", fontFamily:"Georgia,serif", marginBottom:16 }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setReentryModal(null)} style={{ flex:1, padding:12, background:"#111", border:"1px solid #2a2a2a", borderRadius:10, color:"#777", cursor:"pointer", fontSize:14 }}>Cancel</button>
            <button onClick={confirmReentry} style={{ flex:1, padding:12, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer", fontSize:14 }}>Confirm ↩</button>
          </div>
        </Modal>
      )}

      {endModal && (
        <Modal title="🏆 Game Over" onClose={() => setEndModal(false)}>
          <p style={{ color:"#555", fontSize:13, margin:"0 0 16px" }}>Final standings — lowest score wins!</p>
          {sorted.map((p, rank) => {
            const busted = bustedPlayers.has(p.id); const pi = playerIndex(p.id);
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10, padding:"10px 14px", background:rank===0?"#1f1a00":"#111", borderRadius:10, border:rank===0?"1px solid #FFD93D44":"1px solid transparent" }}>
                <span style={{ fontSize:18 }}>{MEDALS[rank]}</span>
                <div style={{ width:26, height:26, borderRadius:"50%", background:COLORS[pi%COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff" }}>{p.name[0]?.toUpperCase()}</div>
                <span style={{ flex:1, fontSize:14 }}>{p.name}{busted?" 💀":""}</span>
                <span style={{ fontSize:16, fontWeight:700, color:rank===0?"#FFD93D":busted?"#FF6B6B":"#f0ece0" }}>{totals[p.id]}</span>
              </div>
            );
          })}
          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={() => { setEndModal(false); setRounds([]); setBustedPlayers(new Set()); const init={}; players.forEach(p=>{init[p.id]="";}); setCurrentInput(init); }}
              style={{ flex:1, padding:12, background:"#111", border:"1px solid #2a2a2a", borderRadius:10, color:"#888", cursor:"pointer", fontSize:14 }}>Rematch ↺</button>
            <button onClick={resetGame} style={{ flex:1, padding:12, background:"#FFD93D", border:"none", borderRadius:10, color:"#111", fontWeight:700, cursor:"pointer", fontSize:14 }}>New Game →</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
