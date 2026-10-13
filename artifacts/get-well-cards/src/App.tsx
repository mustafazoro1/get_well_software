import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

type FloatingEffect = { id: number; x: number; y: number; emoji: string };
type FallingKind = '💕' | '🍵' | '🍲' | '🤒' | '🥤';
type FallingItem = { id: number; x: number; y: number; kind: FallingKind };
type MysteryCard = { id: number; reward: string; emoji: string; trap: boolean; revealed: boolean };
type CareModal = 'potion' | 'shield' | 'rest' | 'note' | 'letter' | null;
type EvadeState = { x: number; items: FallingItem[]; score: number; lives: number; time: number; elapsed: number; spawnIn: number; nextId: number };

const checklistItems = [
  'Drank warm tea/water (No cold Monster today! 🍵)',
  'Took medicines on time 💊',
  'Hugged/petted Bablu (or thought about him) 🐱',
  '20 min power nap for exam brain boost 💤',
  'Smiled at Zizi’s note 😊',
];
const purrNotes = [
  'Bablu says: you are his favourite warm pillow. 🐾',
  'Tiny purr delivery: Zizi is cheering for you, always. 💗',
  'Bablu would lend you every one of his nine naps. 💤',
  'One soft head-bonk, from both of us. Feel better soon! 🐱',
];
const rewardDeck = [
  { reward: 'Sheriff Shield', emoji: '🛡️', trap: false },
  { reward: 'Care Package', emoji: '🎁', trap: false },
  { reward: 'Bablu Hug', emoji: '🐱', trap: false },
  { reward: 'Sheriff Shield', emoji: '🛡️', trap: false },
  { reward: 'Care Package', emoji: '🎁', trap: false },
  { reward: 'Bablu Hug', emoji: '🐱', trap: false },
  { reward: 'Fever Murderer', emoji: '🤒', trap: true },
  { reward: 'Fever Murderer', emoji: '🤒', trap: true },
  { reward: 'Fever Murderer', emoji: '🤒', trap: true },
];

function shuffle<T,>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTodayKey() {
  const now = new Date();
  return `zizi-care-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function playChime(muted: boolean) {
  if (muted || typeof window.AudioContext === 'undefined') return;
  try {
    const context = new window.AudioContext();
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const startAt = context.currentTime + index * 0.09;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(0.045, startAt + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.45);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch { /* Chimes are a small extra; unavailable audio never blocks care. */ }
}

function loadChecklist() {
  try {
    const saved = localStorage.getItem(getTodayKey());
    const parsed = saved ? JSON.parse(saved) : [];
    return checklistItems.map((_, index) => Boolean(parsed[index]));
  } catch {
    return checklistItems.map(() => false);
  }
}

function makeMysteryCards(): MysteryCard[] {
  return shuffle(rewardDeck).map((card, id) => ({ ...card, id, revealed: false }));
}

function makeMemoryDeck() {
  return shuffle(['💕', '💕', '🍏', '🍏', '🍲', '🍲', '🐱', '🐱', '💕', '💕', '🍏', '🍏', '🍲', '🍲', '🐱', '🐱'].map((emoji, id) => ({ id, emoji })));
}

function MusicPlayer({ muted, onToggleMute }: { muted: boolean; onToggleMute: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setMessage('');
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setMessage('The tune could not start just now. Try again in a moment.');
    }
  };

  return (
    <aside className="music-player" aria-label="Cozy music controls">
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/zizi-lofi.mp3`} loop preload="none" muted={muted} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className="music-meta">
        <div className="music-title">Zizi’s soft little tune</div>
        <div className="music-sub">a small Lahore-bound lullaby</div>
      </div>
      <button className="music-control" type="button" onClick={() => void togglePlay()} aria-label={playing ? 'Pause music' : 'Play music'} title={playing ? 'Pause music' : 'Play music'} data-testid="button-music-play-pause">
        {playing ? 'Ⅱ' : '▶'}
      </button>
      <button className="music-control" type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute music and chimes' : 'Mute music and chimes'} aria-pressed={muted} title={muted ? 'Unmute music and chimes' : 'Mute music and chimes'} data-testid="button-music-mute">
        {muted ? '◌' : '♪'}
      </button>
      {message && <div className="music-error" role="status">{message}</div>}
    </aside>
  );
}

function EvadeGame() {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [feedback, setFeedback] = useState('Your only job: collect care, dodge the sniffles, and take it easy.');
  const [items, setItems] = useState<FallingItem[]>([]);
  const [playerX, setPlayerX] = useState(50);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<EvadeState>({ x: 50, items: [], score: 0, lives: 3, time: 30, elapsed: 0, spawnIn: 0, nextId: 0 });
  const keysRef = useRef({ left: false, right: false });
  const touchDirectionRef = useRef<-1 | 0 | 1>(0);

  const finishRound = (message: string) => {
    setRunning(false);
    setFeedback(message);
  };

  useEffect(() => {
    if (!running) return undefined;
    let frame = 0;
    let previous = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (!previous) previous = now;
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      const game = gameRef.current;
      game.elapsed += dt;
      game.time = Math.max(0, 30 - game.elapsed);
      const direction = Number(keysRef.current.right || touchDirectionRef.current === 1) - Number(keysRef.current.left || touchDirectionRef.current === -1);
      game.x = Math.min(94, Math.max(6, game.x + direction * 48 * dt));

      game.spawnIn -= dt;
      if (game.spawnIn <= 0) {
        const kinds: FallingKind[] = ['💕', '🍵', '🍲', '🤒', '🥤'];
        game.items.push({ id: game.nextId++, x: 8 + Math.random() * 84, y: -7, kind: kinds[Math.floor(Math.random() * kinds.length)] });
        game.spawnIn = 0.62 + Math.random() * 0.34;
      }

      const removed = new Set<number>();
      game.items.forEach((item) => {
        item.y += (24 + Math.min(game.elapsed, 18) * 0.55) * dt;
        if (item.y > 105) removed.add(item.id);
        const xDistance = Math.abs(item.x - game.x) * (boardRef.current?.clientWidth ?? 400) / 100;
        const yDistance = Math.abs(item.y - 82) * (boardRef.current?.clientHeight ?? 300) / 100;
        if (xDistance < 32 && yDistance < 29) {
          removed.add(item.id);
          if (item.kind === '🤒') {
            game.lives = Math.max(0, game.lives - 1);
            setLives(game.lives);
            setFeedback(game.lives ? 'A sniffle bonked the basket. Slow and steady, you still have this. 🤒' : 'Round over — now it is time for a proper blanket break.');
          } else if (item.kind === '🥤') {
            setFeedback('Monster safely saved for a well-again day. Warm tea is the real power-up. 🍵');
          } else {
            game.score += item.kind === '🍵' || item.kind === '🍲' ? 2 : 1;
            setScore(game.score);
            setFeedback(item.kind === '🍵' ? 'Warm tea collected: two cozy care points. Zizi approves. 🍵' : item.kind === '🍲' ? 'Soup secured — a very good real-life power-up. 🍲' : 'A little heart for your blanket fort. 💕');
          }
        }
      });
      game.items = game.items.filter((item) => !removed.has(item.id));

      if (now - lastPaint > 30) {
        lastPaint = now;
        setItems([...game.items]);
        setPlayerX(game.x);
        setTimeLeft(Math.ceil(game.time));
      }
      if (game.lives <= 0) {
        finishRound(`Blanket break! You gathered ${game.score} care points. The real-life prize is resting up.`);
        return;
      }
      if (game.time <= 0) {
        setTimeLeft(0);
        finishRound(`Round complete! You evaded the fever and gathered ${game.score} care points. Time for a well-earned blanket break.`);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      if (['arrowleft', 'a'].includes(key)) { keysRef.current.left = pressed; if (running) event.preventDefault(); }
      if (['arrowright', 'd'].includes(key)) { keysRef.current.right = pressed; if (running) event.preventDefault(); }
    };
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [running]);

  const begin = () => {
    gameRef.current = { x: 50, items: [], score: 0, lives: 3, time: 30, elapsed: 0, spawnIn: 0.4, nextId: 0 };
    keysRef.current = { left: false, right: false };
    touchDirectionRef.current = 0;
    setItems([]);
    setPlayerX(50);
    setScore(0);
    setLives(3);
    setTimeLeft(30);
    setFeedback('You’ve got this, Cute Monster. Tea and soup are the good stuff. 🍵');
    setRunning(true);
  };
  const dragBasket = (event: PointerEvent<HTMLDivElement>) => {
    if (!running || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((event.clientX - rect.left) / rect.width) * 100));
    gameRef.current.x = x;
    setPlayerX(x);
  };
  const setTouchDirection = (event: PointerEvent<HTMLButtonElement>, value: -1 | 1) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDirectionRef.current = value;
  };
  const stopTouchDirection = () => { touchDirectionRef.current = 0; };

  return (
    <>
      <div className="game-board evade-board" ref={boardRef} onPointerDown={(event) => { if (running) { event.currentTarget.setPointerCapture(event.pointerId); dragBasket(event); } }} onPointerMove={(event) => { if (event.buttons > 0) dragBasket(event); }} aria-label="Evade game field. Drag the basket left and right, or use the arrow keys. Catch hearts, tea, and soup; avoid fever clouds.">
        {running ? (
          <>
            <div className="game-hud" aria-label={`Time ${timeLeft} seconds, lives ${lives}`}>
              <span>{timeLeft}s left</span><span aria-label={`${lives} lives remaining`}>{'♥ '.repeat(lives)}{'♡ '.repeat(3 - lives)}</span>
            </div>
            {items.map((item) => <div className="moving-item" key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%,-50%)' }} aria-hidden="true">{item.kind}</div>)}
            <div className="moving-item" style={{ left: `${playerX}%`, top: '82%', transform: 'translate(-50%,-50%)', background: '#f7dfe5' }} aria-hidden="true">🧺</div>
          </>
        ) : (
          <div className="game-instructions">
            <div className="game-instructions-inner">
              <div className="game-emoji" aria-hidden="true">🧺 🍵 💕</div>
              <h3>{timeLeft === 0 || lives === 0 ? 'Round tucked in!' : 'Evade the Fever'}</h3>
              <p>Drag the basket or use ← → / A D. Collect tea, soup and hearts; dodge fever clouds. The can can wait for a well-again day.</p>
              <button className="button-primary" type="button" onClick={begin} data-testid="button-start-evade">{timeLeft === 0 || lives === 0 ? 'Play another round' : 'Start a cozy round'}</button>
            </div>
          </div>
        )}
      </div>
      {running && <div className="evade-controls" aria-label="Basket movement">
        <button type="button" aria-label="Move basket left" onPointerDown={(event) => setTouchDirection(event, -1)} onPointerUp={stopTouchDirection} onPointerCancel={stopTouchDirection} onLostPointerCapture={stopTouchDirection}>←</button>
        <button type="button" aria-label="Move basket right" onPointerDown={(event) => setTouchDirection(event, 1)} onPointerUp={stopTouchDirection} onPointerCancel={stopTouchDirection} onLostPointerCapture={stopTouchDirection}>→</button>
      </div>}
      <div className="game-aside">
        <div className="score-ticket"><div className="ticket-label">Care points · 3 gentle chances</div><div className="ticket-score">{score} · {lives} ♥</div></div>
        <div className="game-feedback" aria-live="polite">{feedback}</div>
        {running && <button className="button-soft" type="button" onClick={() => finishRound('Round stopped for a blanket break. Start a fresh round whenever you feel ready.')}>Take a blanket break</button>}
      </div>
    </>
  );
}

function MysteryGame() {
  const [cards, setCards] = useState(makeMysteryCards);
  const [score, setScore] = useState(0);
  const [flips, setFlips] = useState(0);
  const [feedback, setFeedback] = useState('Pick a mystery card. Zizi packed a few good surprises.');
  const finished = cards.every((card) => card.revealed);
  const flip = (id: number) => {
    if (finished || cards.find((card) => card.id === id)?.revealed) return;
    const chosen = cards.find((card) => card.id === id);
    if (!chosen) return;
    setCards((current) => current.map((card) => card.id === id ? { ...card, revealed: true } : card));
    setFlips((current) => current + 1);
    if (chosen.trap) {
      setScore((current) => Math.max(0, current - 1));
      setFeedback('Fever Murderer! One point slipped away — tuck in and let your body do its thing. 🤒');
    } else {
      setScore((current) => current + 1);
      setFeedback(`${chosen.reward}! Zizi tucked that one in just for you. ${chosen.emoji}`);
    }
  };
  const replay = () => {
    setCards(makeMysteryCards());
    setScore(0);
    setFlips(0);
    setFeedback('A fresh little mystery, just for you.');
  };

  return (
    <>
      <div className="game-board" style={{ display: 'grid', placeItems: 'center', padding: 14 }}>
        <div>
          <div className="mystery-grid">
            {cards.map((card) => (
              <button className={`mystery-card ${card.revealed ? 'flipped' : ''} ${card.revealed && card.trap ? 'trap' : ''}`} key={card.id} type="button" onClick={() => flip(card.id)} aria-label={card.revealed ? `Revealed ${card.reward}` : `Flip mystery card ${card.id + 1}`} data-testid={`button-mystery-card-${card.id}`}>
                {card.revealed ? <><span style={{ fontSize: 26 }}>{card.emoji}</span><span>{card.reward}</span></> : <span aria-hidden="true">?</span>}
              </button>
            ))}
          </div>
          {finished && <div className="game-status" role="status">All the cards are cozy-side up. You found {score} care surprises! 💗</div>}
        </div>
      </div>
      <div className="game-aside">
        <div className="score-ticket"><div className="ticket-label">Care points · {flips} flips</div><div className="ticket-score">{score}</div></div>
        <div className="game-feedback" aria-live="polite">{feedback}</div>
        <button className="button-soft" type="button" onClick={replay} data-testid="button-replay-mystery">Shuffle &amp; replay ↻</button>
      </div>
    </>
  );
}

function MemoryGame() {
  const [tiles, setTiles] = useState(makeMemoryDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const lockRef = useRef(false);
  const flipTimerRef = useRef<number | null>(null);
  const won = matched.length === tiles.length;

  useEffect(() => () => {
    if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
  }, []);

  const choose = (id: number) => {
    if (lockRef.current || selected.includes(id) || matched.includes(id)) return;
    const next = [...selected, id];
    setSelected(next);
    if (next.length === 2) {
      setTurns((current) => current + 1);
      lockRef.current = true;
      const first = tiles.find((tile) => tile.id === next[0]);
      const second = tiles.find((tile) => tile.id === next[1]);
      flipTimerRef.current = window.setTimeout(() => {
        if (first?.emoji === second?.emoji) setMatched((current) => [...current, ...next]);
        setSelected([]);
        lockRef.current = false;
        flipTimerRef.current = null;
      }, first?.emoji === second?.emoji ? 360 : 850);
    }
  };

  const replay = () => {
    if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = null;
    setTiles(makeMemoryDeck());
    setSelected([]);
    setMatched([]);
    setTurns(0);
    lockRef.current = false;
  };

  return (
    <>
      <div className="game-board" style={{ display: 'grid', placeItems: 'center', padding: 14 }}>
        <div>
          <div className="memory-grid">
            {tiles.map((tile) => {
              const visible = selected.includes(tile.id) || matched.includes(tile.id);
              return <button key={tile.id} className={`memory-tile ${visible ? 'revealed' : ''} ${matched.includes(tile.id) ? 'matched' : ''}`} type="button" disabled={lockRef.current || matched.includes(tile.id)} onClick={() => choose(tile.id)} aria-label={visible ? `Tile ${tile.emoji}${matched.includes(tile.id) ? ', matched' : ''}` : 'Reveal a mystery memory tile'} data-testid={`button-memory-tile-${tile.id}`}>{visible ? tile.emoji : '✿'}</button>;
            })}
          </div>
          {won && <div className="game-status" role="status">Get-Well Beacon crafted! Bablu approves. 🐱</div>}
        </div>
      </div>
      <div className="game-aside">
        <div className="score-ticket"><div className="ticket-label">Pairs crafted · {turns} turns</div><div className="ticket-score">{matched.length / 2}/8</div></div>
        <div className="game-feedback" aria-live="polite">{won ? 'Every little block found its twin. You did it!' : 'Match pairs of hearts, golden apples, soup & Bablu to light your Get-Well Beacon.'}</div>
        <button className="button-soft" type="button" onClick={replay} data-testid="button-replay-memory">Start a fresh grid ↻</button>
      </div>
    </>
  );
}

function App() {
  const [checked, setChecked] = useState<boolean[]>(loadChecklist);
  const [tab, setTab] = useState(0);
  const [muted, setMuted] = useState(false);
  const [theme, setTheme] = useState<'paper' | 'neon'>(() => {
    try { return localStorage.getItem('zizi-scrapbook-theme') === 'neon' ? 'neon' : 'paper'; } catch { return 'paper'; }
  });
  const [activeModal, setActiveModal] = useState<CareModal>(null);
  const [purrNote, setPurrNote] = useState('Tap Bablu for a cuddle-sized note from Zizi.');
  const [showReply, setShowReply] = useState(false);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [confetti, setConfetti] = useState(false);
  const effectId = useRef(0);
  const previousCount = useRef(checked.filter(Boolean).length);
  const count = checked.filter(Boolean).length;
  const remainingItems = checklistItems.filter((_, index) => !checked[index]);

  useEffect(() => {
    try { localStorage.setItem(getTodayKey(), JSON.stringify(checked)); } catch { /* Local persistence is optional if storage is unavailable. */ }
    if (count === 5 && previousCount.current < 5) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 2800);
    }
    previousCount.current = count;
  }, [checked, count]);

  useEffect(() => {
    try { localStorage.setItem('zizi-scrapbook-theme', theme); } catch { /* Theme still works for this visit. */ }
  }, [theme]);

  useEffect(() => {
    if (!activeModal) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeModal]);

  const spawnEffect = (x: number, y: number, emoji: string) => {
    const id = effectId.current++;
    setEffects((current) => [...current.slice(-17), { id, x, y, emoji }]);
    window.setTimeout(() => setEffects((current) => current.filter((item) => item.id !== id)), 1300);
  };

  const toggleCheck = (index: number) => {
    setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
    if (!checked[index]) playChime(muted);
  };

  const resetChecklist = () => {
    setChecked(checklistItems.map(() => false));
    setConfetti(false);
  };

  const hugBablu = (event: MouseEvent<HTMLButtonElement>) => {
    setPurrNote(purrNotes[Math.floor(Math.random() * purrNotes.length)]);
    playChime(muted);
    const rect = event.currentTarget.getBoundingClientRect();
    for (let index = 0; index < 8; index += 1) {
      window.setTimeout(() => spawnEffect(rect.left + rect.width / 2 + (Math.random() - .5) * 90, rect.top + rect.height / 2 + (Math.random() - .5) * 60, index % 2 ? '💕' : '✦'), index * 45);
    }
  };

  const tabs = ['Evade the Fever', 'MM2 Mystery Role / Innocent Collector', 'Minecraft Heart Craft'];
  const modalIsLetter = activeModal === 'letter';
  const modalIcon = activeModal === 'potion' ? '🧪' : activeModal === 'shield' ? '🛡️' : activeModal === 'rest' ? '🍏' : '💌';

  return (
    <div className={`page-shell mobile-safe ${theme === 'neon' ? 'theme-neon' : ''}`}>
      <div className="falling-hearts" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => <span className="falling-heart" key={index} style={{ left: `${7 + index * 14}%`, ['--fall-delay' as string]: `${index * -2.4}s`, ['--fall-duration' as string]: `${15 + (index % 3) * 3}s`, ['--heart-size' as string]: `${15 + (index % 3) * 4}px` }}>♡</span>)}
      </div>
      <div className="wrap">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Zizi’s get-well scrapbook home">
            <span><span className="brand-name">Zizi’s care parcel</span><span className="brand-caption">a little love, wrapped up</span></span>
          </a>
          <div className="header-tools">
            <div className="theme-picker" role="group" aria-label="Choose scrapbook theme">
              <button className="theme-choice" type="button" aria-pressed={theme === 'paper'} onClick={() => setTheme('paper')}>Soft mode</button>
              <button className="theme-choice" type="button" aria-pressed={theme === 'neon'} onClick={() => setTheme('neon')}>Gamer mode</button>
            </div>
            <MusicPlayer muted={muted} onToggleMute={() => setMuted((current) => !current)} />
          </div>
        </header>

        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">A tiny care package from Zizi</div>
              <h1 id="hero-title">Get Well Soon,<span>Cute Monster! <span className="hero-flower" aria-hidden="true">🌸</span></span></h1>
              <p className="hero-subtitle">A little parcel crossing the miles from Karachi to Lahore. No rush on getting better; just take today gently.</p>
              <p className="hero-subtitle" style={{ marginTop: 11 }}>Rest first, then slay those tests when you’re ready. Bablu and I are cheering for you. 📚</p>
              <div className="hero-buttons">
                <a className="button-primary" href="#care" data-testid="link-to-care">Open today’s care list <span aria-hidden="true">↓</span></a>
                <button className="button-soft" type="button" onClick={() => setActiveModal('letter')} data-testid="button-open-letter">Open Zizi’s letter 💌</button>
                <a className="button-soft" href="#arcade" data-testid="link-to-arcade">Take a tiny game break</a>
              </div>
            </div>
            <div className="hero-art" role="img" aria-label="A hand-wrapped care parcel with a heart, cat, star, and tea">
              <div className="sunburst" />
              <div className="care-parcel"><div className="parcel-ribbon" /><span className="parcel-heart" aria-hidden="true">♥</span></div>
              <div className="float-sticker sticker-cat" aria-hidden="true">🐱</div>
              <div className="float-sticker sticker-star" aria-hidden="true">✦</div>
              <div className="float-sticker sticker-tea" aria-hidden="true">🍵</div>
            </div>
          </section>

          <section className="mood-card" aria-label="A little Lahore weather report">
            <div className="mood-icon" aria-hidden="true">🌸</div>
            <div><div className="mood-label">A little Lahore weather report · from Karachi</div><div className="mood-text">Forecast: bed, blanket, warm soup, and absolutely no pressure. 🌸</div></div>
          </section>

          <section className="section" aria-labelledby="care-kit-heading">
            <div className="section-heading">
              <div><p className="section-kicker">A little power-up from your bestie</p><h2 className="section-title" id="care-kit-heading">Cute Monster Care Kit 🌷</h2></div>
              <div className="section-aside">choose a gentle boost ♡</div>
            </div>
            <div className="care-kit-grid">
              <button className="care-kit-button potion-card" type="button" onClick={() => setActiveModal('potion')} data-testid="button-open-potion">
                <span className="care-kit-icon" aria-hidden="true">🧪</span><span><strong>Monster Energy Health Potion</strong><small>A warm-drink reminder</small></span><span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button shield-card" type="button" onClick={() => setActiveModal('shield')} data-testid="button-open-shield">
                <span className="care-kit-icon" aria-hidden="true">🛡️</span><span><strong>MM2 / Evade Emergency Shield</strong><small>Your cozy gamer pep talk</small></span><span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button rest-card" type="button" onClick={() => setActiveModal('rest')} data-testid="button-open-rest-check">
                <span className="care-kit-icon" aria-hidden="true">🍏</span><span><strong>Minecraft Golden Apple Rest Check</strong><small>{count}/5 real-life hearts restored</small></span><span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button note-card" type="button" onClick={() => setActiveModal('note')} data-testid="button-open-note">
                <span className="care-kit-icon" aria-hidden="true">💌</span><span><strong>Message from Zizi</strong><small>A little love, just for you</small></span><span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </section>

          <section className="section" aria-labelledby="bablu-heading">
            <div className="section-heading">
              <div><p className="section-kicker">Certified by the house cat</p><h2 className="section-title" id="bablu-heading">A Bablu-sized hug 🐱</h2></div>
              <div className="section-aside">highly effective purr therapy</div>
            </div>
            <div className="scrap-card hug-card">
              <div>
                <div className="handwritten">“I asked Bablu to sit with you for a minute. He said yes, but only if there are snacks.”</div>
                <div className="hug-note" aria-live="polite">{purrNote}</div>
                <div className="tap-hint">Tap the kitty whenever you need a soft moment.</div>
                <button className="button-soft check-on-zizi" type="button" aria-expanded={showReply} aria-controls="zizi-reply" onClick={() => setShowReply((value) => !value)} data-testid="button-check-on-zizi">{showReply ? 'Tuck the reply away' : 'Check on Zizi & Bablu'}</button>
                {showReply && <div className="reply-note" id="zizi-reply" role="status">We’re okay, promise. Bablu is loafed beside me, and I’m thinking of you from Karachi. Drink a little water for me? ♡</div>}
              </div>
              <button className="hug-cat" type="button" onClick={hugBablu} aria-label="Give Bablu a hug and get a purr note" data-testid="button-hug-bablu">🐱</button>
            </div>
          </section>

          <section className="section" id="care" aria-labelledby="care-heading">
            <div className="section-heading">
              <div><p className="section-kicker">Little things count, lovely</p><h2 className="section-title" id="care-heading">Today’s gentle-care list</h2></div>
              <div className="section-aside">one tiny tick at a time ♡</div>
            </div>
            <div className="care-layout">
              <div className="scrap-card checklist">
                <div className="care-top">
                  <div className="care-meter" aria-live="polite">Care Meter: {count}/5 Completed</div>
                  <button className="button-quiet" type="button" onClick={resetChecklist} aria-label="Reset today's checklist" data-testid="button-reset-checklist">Reset today ↺</button>
                </div>
                <div className="progress-track" role="progressbar" aria-label="Care checklist progress" aria-valuemin={0} aria-valuemax={5} aria-valuenow={count}><div className="progress-fill" style={{ width: `${count * 20}%` }} /></div>
                <div>
                  {checklistItems.map((item, index) => (
                    <label className={`check-row ${checked[index] ? 'done' : ''}`} key={item}>
                      <input type="checkbox" checked={checked[index]} onChange={() => toggleCheck(index)} data-testid={`checkbox-care-${index}`} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <aside className="scrap-card care-note">
                <div className="note-tape" />
                <h3>A note from Zizi 💌</h3>
                <p>Warm soup and water first, okay? The cold Monster can wait until you’re feeling like yourself again. Rest is part of the plan, not a detour.</p>
                <div className="left-today">
                  <div className="left-today-label">What’s left today</div>
                  <div className="left-today-text" aria-live="polite" data-testid="status-whats-left">
                    {remainingItems.length ? (
                      <ul className="left-today-list">
                        {remainingItems.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : 'Nothing left to do. Your only task now is to rest. ♡'}
                  </div>
                </div>
                <div className="note-sign">love you heaps, Zizi ♡</div>
              </aside>
            </div>
          </section>

          <section className="section" id="arcade" aria-labelledby="arcade-heading">
            <div className="section-heading">
              <div><p className="section-kicker">A tiny break between naps</p><h2 className="section-title" id="arcade-heading">Zizi’s cozy arcade 🎮</h2></div>
              <div className="section-aside">Roblox MM2 &amp; Evade, Minecraft-style love</div>
            </div>
            <div className="scrap-card arcade">
              <div className="game-tabs" role="tablist" aria-label="Choose a mini game">
                {tabs.map((label, index) => (
                  <button className="game-tab" key={label} id={`game-tab-${index}`} type="button" role="tab" aria-selected={tab === index} aria-controls="game-panel" onClick={() => setTab(index)} data-testid={`tab-mini-game-${index}`}>{index === 0 ? '🥤 ' : index === 1 ? '🕵️ ' : '💎 '}{label}</button>
                ))}
              </div>
              <div id="game-panel" className="game-content" role="tabpanel" aria-labelledby={`game-tab-${tab}`}>
                {tab === 0 ? <EvadeGame /> : tab === 1 ? <MysteryGame /> : <MemoryGame />}
              </div>
              <div className="game-bottom">No pressure to win, Cutie. The important mission is feeling a little better. ♡</div>
            </div>
          </section>
        </main>
        <footer className="footer">Wrapped up with care, warm tea, and <span className="footer-heart">♥</span> — Zizi &amp; Bablu, Karachi-to-Lahore</footer>
      </div>

      <div className="tap-effects" aria-hidden="true">
        {effects.map((effect) => <span key={effect.id} className="tap-effect" style={{ left: effect.x, top: effect.y }}>{effect.emoji}</span>)}
      </div>
      {confetti && <div className="confetti-layer" aria-hidden="true">
        {Array.from({ length: 38 }, (_, index) => <span className="confetti-piece" key={index} style={{ left: `${(index * 2.71) % 100}%`, background: ['#eaa1b0', '#f2d58f', '#c4ddc7', '#cf8da0', '#f5c6ae'][index % 5], animationDelay: `${(index % 12) * .07}s`, transform: `rotate(${index * 31}deg)` }} />)}
      </div>}
      {activeModal && (
        <div className="care-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setActiveModal(null); }}>
          <section className="care-modal" role="dialog" aria-modal="true" aria-labelledby="care-modal-title">
            <button className="care-modal-close" type="button" aria-label="Close care note" onClick={() => setActiveModal(null)} data-testid="button-close-care-modal">×</button>
            <div className="care-modal-icon" aria-hidden="true">{modalIcon}</div>
            <p className="section-kicker">{modalIsLetter ? 'A letter, sent with all my love' : 'A tiny note, just for you'}</p>
            <h2 id="care-modal-title">{modalIsLetter ? 'For my Cute Monster' : activeModal === 'potion' ? 'Monster Energy Health Potion' : activeModal === 'shield' ? 'MM2 / Evade Emergency Shield' : activeModal === 'rest' ? 'Minecraft Golden Apple Rest Check' : 'A note from Zizi'}</h2>
            <p>{modalIsLetter
              ? 'My dear Cute Monster, I wish I could bring this little parcel from Karachi to Lahore myself. Until then, let Bablu keep you company, drink something warm, and let your body set the pace. You don’t have to be cheerful or productive for me. I love you on slow days, too. When you feel ready, we’ll celebrate getting through your tests together. For now: blanket, breath, and one small sip. All my love, Zizi ♡'
              : activeModal === 'potion'
                ? 'Your real-life health bar comes first, Cutie. While you are feeling under the weather, try warm water, soup, or tea instead of a cold Monster. Save the can for a well-again day. 🍵'
                : activeModal === 'shield'
                  ? 'Shield activated! You do not have to speedrun getting better. Rest now, let Bablu keep watch, and come back to Roblox and Minecraft when you feel ready. The bravest move is taking the time to heal. 🎮'
                  : activeModal === 'rest'
                    ? 'A tiny daily quest for your real-life health bar. Tap each one as you do it today.'
                    : 'My dear Cute Monster, sending the warmest hug all the way from Karachi to Lahore. Rest your body, let Bablu be your little nurse, and take your exams one calm step at a time. You are loved, and I am cheering for you always. Take rest now so you can slay your tests next week! 📚✨'}
            </p>
            {activeModal === 'rest' ? (
              <>
                <div className="modal-care-meter">Care Meter: {count}/5 Completed</div>
                <div className="modal-checklist">
                  {checklistItems.map((item, index) => (
                    <button className={`modal-check-row ${checked[index] ? 'done' : ''}`} type="button" key={item} onClick={() => toggleCheck(index)} aria-pressed={checked[index]} data-testid={`button-modal-care-${index}`}>
                      <span className="modal-check-box" aria-hidden="true">{checked[index] ? '✓' : ''}</span><span>{item}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="care-modal-sign">with all my love, Zizi ♡</div>
                <button className="button-primary care-modal-done" type="button" onClick={() => setActiveModal(null)} data-testid="button-finish-care-note">Tucked that hug away ♡</button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
