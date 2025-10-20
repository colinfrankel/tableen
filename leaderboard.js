// Leaderboard logic using Firestore (uid-based docs)
(function(){
  function getDB(){ return window._firestore || (window.firebase && firebase.firestore && firebase.firestore()) || null; }
  function getAuth(){ return (window.firebase && firebase.auth && firebase.auth()) || null; }

  async function waitForUid(){
    const auth = getAuth();
    if (!auth) return null;
    if (auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
    return new Promise(resolve => {
      const un = auth.onAuthStateChanged(u => { un(); resolve(u ? u.uid : null); });
    });
  }

  async function loadLeaderboard(){
    const db = getDB();
    const list = document.getElementById('leaderboardList');
    const section = document.getElementById('leaderboard');
    if (!db || !list || !section) return;
    try {
      const snap = await db.collection('users')
        .where('games', '>', 0)
        .orderBy('games', 'desc')
        .limit(25)
        .get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        const wins = d.wins || 0;
        const games = d.games || 0;
        const winPct = games ? Math.round((wins * 1000) / games) / 10 : 0;
        rows.push({ name: d.name || 'Player', wins, games, winPct });
      });
      rows.sort((a,b) => (b.winPct - a.winPct) || (b.wins - a.wins));
      list.innerHTML = '';
      rows.slice(0, 10).forEach(r => {
        const li = document.createElement('li');
        li.textContent = `${r.name} — ${r.wins}W/${r.games}G (${r.winPct.toFixed(1)}%)`;
        list.appendChild(li);
      });
      section.classList.remove('hidden');
    } catch (e) {
      console.warn('Leaderboard load failed:', e);
    }
  }

  async function pushStats({ name, wins, games }){
    const db = getDB(); if (!db) return;
    const uid = await waitForUid(); if (!uid) return;
  const ref = db.collection('users').doc(uid);
    await ref.set({
      name: name || 'Player',
      wins: wins || 0,
      games: games || 0,
      updatedAt: Date.now()
    }, { merge: true });
  }

  window.TableenLB = { loadLeaderboard, pushStats };
  document.addEventListener('DOMContentLoaded', loadLeaderboard);
})();
