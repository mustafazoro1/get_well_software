import './_group.css';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

type FloatingEffect = { id: number; x: number; y: number; emoji: string };
type FallingItem = { id: number; x: number; y: number; kind: '🥤' | '💕' | '🍵' | '🤒' };
type MysteryCard = { id: number; reward: string; emoji: string; trap: boolean; revealed: boolean };
type CareModal = 'potion' | 'shield' | 'rest' | 'note' | null;

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
  const context = new window.AudioContext();
  const notes = [659.25, 880];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const startAt = context.currentTime + index * 0.09;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(0.065, startAt + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.45);
  });
  window.setTimeout(() => void context.close(), 800);
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
  const [playing, setPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<OscillatorNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const melodyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (gainRef.current && contextRef.current) {
      gainRef.current.gain.setTargetAtTime(muted ? 0 : 0.025, contextRef.current.currentTime, 0.05);
    }
  }, [muted]);

  const togglePlay = () => {
    if (playing) {
      if (melodyTimerRef.current !== null) window.clearInterval(melodyTimerRef.current);
      melodyTimerRef.current = null;
      nodesRef.current.forEach((node) => {
        try { node.stop(); } catch { /* already stopped */ }
      });
      nodesRef.current = [];
      void contextRef.current?.close();
      contextRef.current = null;
      gainRef.current = null;
      setPlaying(false);
      return;
    }
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.value = muted ? 0 : 0.025;
    gain.connect(context.destination);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1250;
    filter.connect(gain);
    const notes = [110, 164.81, 220];
    const oscillators = notes.map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(filter);
      oscillator.start();
      return oscillator;
    });
    const melody = [329.63, 392, 440, 392, 329.63, 293.66, 261.63, 293.66];
    let melodyIndex = 0;
    melodyTimerRef.current = window.setInterval(() => {
      const startAt = context.currentTime;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = melody[melodyIndex % melody.length];
      melodyIndex += 1;
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(0.18, startAt + 0.06);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.05);
      oscillator.connect(envelope);
      envelope.connect(filter);
      oscillator.onended = () => {
        nodesRef.current = nodesRef.current.filter((node) => node !== oscillator);
        envelope.disconnect();
      };
      nodesRef.current.push(oscillator);
      oscillator.start(startAt);
      oscillator.stop(startAt + 1.08);
    }, 720);
    contextRef.current = context;
    gainRef.current = gain;
    nodesRef.current = oscillators;
    setPlaying(true);
  };

  useEffect(() => () => {
    if (melodyTimerRef.current !== null) window.clearInterval(melodyTimerRef.current);
    nodesRef.current.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    void contextRef.current?.close();
  }, []);

  return (
    <aside className="music-player" aria-label="Cozy ambient music player">
      <div className={`vinyl ${playing ? 'playing' : ''}`} aria-hidden="true">♫</div>
      <div className="music-meta">
        <div className="music-title">Zizi’s soft little tune</div>
        <div className="music-sub">a browser-made lullaby</div>
      </div>
      <button className="music-control" type="button" onClick={togglePlay} aria-label={playing ? 'Pause music' : 'Play music'} title={playing ? 'Pause music' : 'Play music'} data-testid="button-music-play-pause">
        {playing ? 'Ⅱ' : '▶'}
      </button>
      <button className="music-control" type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute music and chimes' : 'Mute music and chimes'} title={muted ? 'Unmute music and chimes' : 'Mute music and chimes'} data-testid="button-music-mute">
        {muted ? '◌' : '♫'}
      </button>
    </aside>
  );
}

function EvadeGame() {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Your only job: dodge the sniffles and collect a little care.');
  const [items, setItems] = useState<FallingItem[]>([]);
  const [player, setPlayer] = useState({ x: 50, y: 82 });
  const boardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          setFeedback(`Time for a blanket break! You collected ${score} care tokens.`);
          return 0;
        }
        return current - 1;
      });
      setItems((current) => {
        const moved = current.map((item) => ({ ...item, y: item.y + 11 })).filter((item) => item.y < 104);
        if (Math.random() < 0.83) {
          const options: FallingItem['kind'][] = ['🥤', '💕', '🍵', '🤒'];
          const kind = options[Math.floor(Math.random() * options.length)];
          moved.push({ id: idRef.current++, x: 8 + Math.random() * 82, y: -12, kind });
        }
        return moved;
      });
    }, 760);
    return () => window.clearInterval(timer);
  }, [running, score]);

  const begin = () => {
    setScore(0);
    setTimeLeft(25);
    setItems([]);
    setPlayer({ x: 50, y: 82 });
    setFeedback('Go, Cute Monster! A warm tea counts double in spirit. 🍵');
    setRunning(true);
  };

  const movePlayer = (event: PointerEvent<HTMLDivElement>) => {
    if (!running || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((event.clientY - rect.top) / rect.height) * 100));
    setPlayer({ x, y });
    const caught = items.find((item) => Math.hypot((item.x - x) * rect.width / 100, (item.y - y) * rect.height / 100) < 46);
    if (caught) {
      setItems((current) => current.filter((item) => item.id !== caught.id));
      if (caught.kind === '🤒') {
        setScore((current) => Math.max(0, current - 1));
        setFeedback('A fever cloud! Take a slow breath; you dodged most of it. 🤒');
      } else {
        setScore((current) => current + (caught.kind === '🍵' ? 2 : 1));
        setFeedback(caught.kind === '🥤' ? 'Monster can safely tucked away for later. Hydration first! 🥤' : caught.kind === '🍵' ? 'Warm tea secured. Zizi is very proud of you. 🍵' : 'A little heart, just for you. 💕');
      }
    }
  };
  const startMovingPlayer = (event: PointerEvent<HTMLDivElement>) => {
    if (!running) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    movePlayer(event);
  };

  return (
    <>
      <div className="game-board" ref={boardRef} onPointerDown={startMovingPlayer} onPointerMove={movePlayer} aria-label="Drag or touch around the game field to catch care items and avoid fever clouds">
        {running ? (
          <>
            {items.map((item) => <div className="moving-item" key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-hidden="true">{item.kind}</div>)}
            <div className="moving-item" style={{ left: `${player.x}%`, top: `${player.y}%`, transform: 'translate(-50%, -50%)', background: '#f7dfe5' }} aria-hidden="true">🧺</div>
            <div style={{ position: 'absolute', top: 10, left: 12, color: '#73545f', fontFamily: 'Fredoka, sans-serif', fontWeight: 600 }}>⏱ {timeLeft}s</div>
          </>
        ) : (
          <div className="game-instructions">
            <div className="game-instructions-inner">
              <div className="game-emoji">🧺 💕 🍵</div>
              <h3>{timeLeft === 0 ? 'Round tucked in!' : 'Evade the Fever'}</h3>
              <p>Drag your basket with a finger. Catch hearts, tea & Monster cans for later; dodge those fever clouds!</p>
              <button className="button-primary" type="button" onClick={(event) => { event.stopPropagation(); begin(); }} data-testid="button-start-evade">{timeLeft === 0 ? 'Play another round' : 'Start a cozy round'}</button>
            </div>
          </div>
        )}
      </div>
      <div className="game-aside">
        <div className="score-ticket"><div className="ticket-label">Care tokens</div><div className="ticket-score">{score}</div></div>
        <div className="game-feedback" aria-live="polite">{feedback}</div>
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
      setFeedback('Fever Murderer! Quick, hide under the blanket. One point slipped away. 🤒');
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
        <button className="button-soft" type="button" onClick={replay} data-testid="button-replay-mystery">Shuffle & replay ↻</button>
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
      if (first?.emoji === second?.emoji) {
        flipTimerRef.current = window.setTimeout(() => {
          setMatched((current) => [...current, ...next]);
          setSelected([]);
          lockRef.current = false;
          flipTimerRef.current = null;
        }, 360);
      } else {
        flipTimerRef.current = window.setTimeout(() => {
          setSelected([]);
          lockRef.current = false;
          flipTimerRef.current = null;
        }, 850);
      }
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
          {won && <div className="game-status" role="status">Get-Well Beacon crafted! Bablu approves. 🐱✨</div>}
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
  const [activeModal, setActiveModal] = useState<CareModal>(null);
  const [purrNote, setPurrNote] = useState('Tap Bablu for a cuddle-sized note from Zizi.');
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [confetti, setConfetti] = useState(false);
  const effectId = useRef(0);
  const previousCount = useRef(checked.filter(Boolean).length);
  const count = checked.filter(Boolean).length;

  useEffect(() => {
    try { localStorage.setItem(getTodayKey(), JSON.stringify(checked)); } catch { /* browser storage can be unavailable */ }
    if (count === 5 && previousCount.current < 5) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 2800);
    }
    previousCount.current = count;
  }, [checked, count]);

  useEffect(() => {
    if (!activeModal) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeModal]);

  const spawnEffect = (x: number, y: number, emoji?: string) => {
    const id = effectId.current++;
    const symbols = ['💕', '✦', '🥤', '✧', '♡'];
    const next = { id, x, y, emoji: emoji ?? symbols[Math.floor(Math.random() * symbols.length)] };
    setEffects((current) => [...current.slice(-17), next]);
    window.setTimeout(() => setEffects((current) => current.filter((item) => item.id !== id)), 1300);
  };

  const handlePageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) return;
    spawnEffect(event.clientX, event.clientY);
  };

  const toggleCheck = (index: number) => {
    setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
    if (!checked[index]) playChime(muted);
  };

  const resetChecklist = () => {
    setChecked(checklistItems.map(() => false));
    setConfetti(false);
  };

  const hugBablu = (event: PointerEvent<HTMLButtonElement>) => {
    setPurrNote(purrNotes[Math.floor(Math.random() * purrNotes.length)]);
    playChime(muted);
    const rect = event.currentTarget.getBoundingClientRect();
    for (let index = 0; index < 8; index += 1) {
      window.setTimeout(() => spawnEffect(rect.left + rect.width / 2 + (Math.random() - .5) * 90, rect.top + rect.height / 2 + (Math.random() - .5) * 60, index % 2 ? '💕' : '✦'), index * 45);
    }
  };

  const tabs = ['Evade the Fever', 'MM2 Mystery Role / Innocent Collector', 'Minecraft Heart Craft'];

  return (
    <div className="page-shell mobile-safe" onClick={handlePageClick}>
      <MusicPlayer muted={muted} onToggleMute={() => setMuted((current) => !current)} />
      <div className="wrap">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Zizi's Get-Well scrapbook home">
            <span className="brand-stamp" aria-hidden="true">Z♡</span>
            <span><span className="brand-name">Zizi’s care parcel</span><span className="brand-caption">a little love, wrapped up</span></span>
          </a>
          <div className="top-note">made for my Cute Monster, with love ♡</div>
        </header>

        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow"><span>✦</span> A tiny care package from Zizi <span>✦</span></div>
              <h1 id="hero-title">Get Well Soon,<span>Cute Monster! 🌸</span></h1>
              <p className="hero-subtitle">Monster Energy &amp; Health Boost</p>
              <p className="hero-subtitle" style={{ marginTop: 13 }}>Sending warm hug vibes all the way to Lahore! 🏙️❤️</p>
              <p className="hero-subtitle" style={{ marginTop: 7 }}>Take rest now so you can slay your tests next week! 📚✨</p>
              <div className="hero-buttons">
                <a className="button-primary" href="#care" data-testid="link-to-care">Open today’s care list <span aria-hidden="true">↓</span></a>
                <a className="button-soft" href="#arcade" data-testid="link-to-arcade">Take a tiny game break 🎮</a>
              </div>
            </div>
            <div className="hero-art" aria-label="A hand-wrapped pink care parcel with a heart">
              <div className="sunburst" />
              <div className="care-parcel"><div className="parcel-ribbon" /><span className="parcel-heart">♥</span></div>
              <div className="float-sticker sticker-cat" aria-hidden="true">🐱</div>
              <div className="float-sticker sticker-star" aria-hidden="true">✦</div>
              <div className="float-sticker sticker-tea" aria-hidden="true">🍵</div>
            </div>
          </section>

          <section className="mood-card" aria-label="Current mood in Lahore">
            <div className="mood-icon" aria-hidden="true">🌸</div>
            <div><div className="mood-label">A little Lahore weather report · from Zizi</div><div className="mood-text">Current Mood in Lahore: Bed, blanket, warm soup, and rest 🌸☕</div></div>
          </section>

          <section className="section" aria-labelledby="care-kit-heading">
            <div className="section-heading">
              <div><p className="section-kicker">A little power-up from your bestie</p><h2 className="section-title" id="care-kit-heading">Cute Monster Care Kit 🌷</h2></div>
              <div className="section-aside">choose a gentle boost ♡</div>
            </div>
            <div className="care-kit-grid">
              <button className="care-kit-button potion-card" type="button" onClick={() => setActiveModal('potion')} data-testid="button-open-potion">
                <span className="care-kit-icon" aria-hidden="true">🧪</span>
                <span><strong>Monster Energy Health Potion</strong><small>A warm-drink reminder</small></span>
                <span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button shield-card" type="button" onClick={() => setActiveModal('shield')} data-testid="button-open-shield">
                <span className="care-kit-icon" aria-hidden="true">🛡️</span>
                <span><strong>MM2 / Evade Emergency Shield</strong><small>Your cozy gamer pep talk</small></span>
                <span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button rest-card" type="button" onClick={() => setActiveModal('rest')} data-testid="button-open-rest-check">
                <span className="care-kit-icon" aria-hidden="true">🍏</span>
                <span><strong>Minecraft Golden Apple Rest Check</strong><small>{count}/5 real-life hearts restored</small></span>
                <span className="care-kit-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="care-kit-button note-card" type="button" onClick={() => setActiveModal('note')} data-testid="button-open-note">
                <span className="care-kit-icon" aria-hidden="true">💌</span>
                <span><strong>Message from Zizi</strong><small>A little love, just for you</small></span>
                <span className="care-kit-arrow" aria-hidden="true">↗</span>
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
                <div style={{ color: '#a18184', fontSize: 12 }}>Tap the kitty whenever you need a soft moment.</div>
              </div>
              <button className="hug-cat" type="button" onPointerDown={hugBablu} aria-label="Give Bablu a hug and get a purr note" data-testid="button-hug-bablu">🐱</button>
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
                <div className="progress-track" role="progressbar" aria-label="Care checklist progress" aria-valuemin={0} aria-valuemax={5} aria-valuenow={count}>
                  <div className="progress-fill" style={{ width: `${count * 20}%` }} />
                </div>
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
        <footer className="footer">Wrapped up with care, warm tea, and <span className="footer-heart">♥</span> — Zizi &amp; Bablu, Lahore-to-Lahore-ish</footer>
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
            <div className="care-modal-icon" aria-hidden="true">{activeModal === 'potion' ? '🧪' : activeModal === 'shield' ? '🛡️' : activeModal === 'rest' ? '🍏' : '💌'}</div>
            <p className="section-kicker">A tiny note, just for you</p>
            <h2 id="care-modal-title">{activeModal === 'potion' ? 'Monster Energy Health Potion' : activeModal === 'shield' ? 'MM2 / Evade Emergency Shield' : activeModal === 'rest' ? 'Minecraft Golden Apple Rest Check' : 'A note from Zizi'}</h2>
            <p>{activeModal === 'potion'
              ? 'Your real-life health bar comes first, Cutie. While you are feeling under the weather, try warm water, soup, or tea instead of a cold Monster. Save the can for a well-again day. 🍵'
              : activeModal === 'shield'
                ? 'Shield activated! You do not have to speedrun getting better. Rest now, let Bablu keep watch, and come back to Roblox and Minecraft when you feel ready. The bravest move is taking the time to heal. 🎮'
                : activeModal === 'rest'
                  ? 'A tiny daily quest for your real-life health bar. Tap each one as you do it today.'
                  : 'My dear Cute Monster, sending the warmest hug all the way to Lahore. Rest your body, let Bablu be your little nurse, and take your exams one calm step at a time. You are loved, and I am cheering for you always. Take rest now so you can slay your tests next week! 📚✨'}
            </p>
            {activeModal === 'rest' ? (
              <>
                <div className="modal-care-meter">Care Meter: {count}/5 Completed</div>
                <div className="modal-checklist">
                  {checklistItems.map((item, index) => (
                    <button className={`modal-check-row ${checked[index] ? 'done' : ''}`} type="button" key={item} onClick={() => toggleCheck(index)} aria-pressed={checked[index]} data-testid={`button-modal-care-${index}`}>
                      <span className="modal-check-box" aria-hidden="true">{checked[index] ? '✓' : ''}</span>
                      <span>{item}</span>
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
