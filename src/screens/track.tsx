import { useEffect, useMemo, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { heightProfile, NOW_COLOUR, PAST_COLOURS, sayDuration, sayKm, trackStats, type Track } from '../finds/track';
import { onRecorder, pauseTrack, recorderState, resumeTrack, startTrack, stopTrack, type RecorderState } from '../finds/track-recorder';
import { deleteTrack, getTrack, listTracks, onWalksChanged, putTrack } from '../finds/track-store';
import { FindsMap, type Trail } from './finds-map';
import { BackLink } from './back-link';
import { Icon } from './icons';

// Record a walk (Stefan 16/10/2026: "like a navigation app, so when I go … I can press start and it kind of tracks my
// kilometres and my route and it shows me where I've walked … stored, so the next day … I can see where the last four
// times I walked is" — the way AllTrails does, with the climb). The rules are src/finds/track.ts, the recording
// src/finds/track-recorder.ts. Recorded walks stay on this phone.

/** How many past walks the map shows at once ("the last four times I walked"). */
export const PAST_ON_MAP = 4;

export function useRecorder(): RecorderState {
  const [s, setS] = useState(recorderState());
  useEffect(() => onRecorder(setS), []);
  return s;
}
/** A clock that ticks every second while `on`, so the time on screen moves. */
function useTick(on: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}
export function useTracks(): Track[] | null {
  const [list, setList] = useState<Track[] | null>(null);
  useEffect(() => {
    const load = () => listTracks().then((l) => setList(l.filter((t) => t.end !== null)), () => setList([]));
    void load();
    return onWalksChanged(() => void load());
  }, []);
  return list;
}
/** The last walks, newest first, each in its own colour, as map lines. */
export const pastTrails = (tracks: Track[], n = PAST_ON_MAP): Trail[] =>
  tracks.slice(0, n).map((t, i) => ({ id: t.id, color: PAST_COLOURS[i % PAST_COLOURS.length], parts: t.parts }));

const sayDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function Stats({ t, now }: { t: Track; now: number }) {
  const s = trackStats(t, now);
  return (
    <div class="track-stats" data-test="track-stats">
      <div><span>Distance</span><strong data-test="track-distance">{sayKm(s.distanceM)}</strong></div>
      <div><span>Time</span><strong data-test="track-time">{sayDuration(s.timeMs)}</strong></div>
      <div><span>Climb</span><strong class="climb" data-test="track-climb">{s.high === null ? '–' : `↑ ${s.up} m ↓ ${s.down} m`}</strong></div>
      <div><span>Highest</span><strong>{s.high === null ? '–' : `${s.high} m`}</strong></div>
    </div>
  );
}

function Legend({ tracks }: { tracks: Track[] }) {
  return (
    <ul class="track-legend" data-test="track-legend">
      {tracks.slice(0, PAST_ON_MAP).map((t, i) => (
        <li key={t.id}><span class="swatch" style={{ background: PAST_COLOURS[i % PAST_COLOURS.length] }} />
          <a href={hrefFor({ name: 'track', id: t.id })}>{sayDay(t.start)}</a> · {sayKm(trackStats(t).distanceM)}</li>
      ))}
    </ul>
  );
}

function KeepScreenNote({ s }: { s: RecorderState }) {
  if (s.paused) return <p class="muted small" data-test="keep-screen">Paused. Nothing is recorded until you press Carry on.</p>;
  if (s.keepScreen === 'on') return <p class="muted small" data-test="keep-screen">The screen is kept on while you record — the iPhone gives the app no position while it is locked. You can put the phone in your pocket with the screen on.</p>;
  return (
    <p class="card alert" data-test="keep-screen">This phone would not keep the screen on. ⚠ Keep it from locking while you walk: an iPhone
      gives the app no position while the screen is locked, and that part of the walk is then left out. For the walk:
      Settings ▸ Display &amp; Brightness ▸ Auto-Lock ▸ Never (set it back afterwards).</p>
  );
}

function Recording({ s, tracks }: { s: RecorderState; tracks: Track[] | null }) {
  const t = s.track!;
  const now = useTick(!s.paused);
  const [showPast, setShowPast] = useState(false);
  const trails = useMemo<Trail[]>(() => [...(showPast && tracks ? pastTrails(tracks) : []), { id: t.id, color: NOW_COLOUR, parts: t.parts }],
    [t, showPast, tracks]);
  const here = s.here ? { lat: s.here.lat, lon: s.here.lon, accuracy: s.here.accuracy } : null;
  const stop = async () => {
    if (!confirm('Stop and save this walk?')) return;
    const done = await stopTrack();
    if (done) location.hash = hrefFor({ name: 'track', id: done.id });
  };
  const stats = trackStats(t, now);
  return (
    <>
      <p class="recording-now" data-test="recording-now"><span class="rec-dot" />{s.paused ? 'Paused' : 'Recording'} · started{' '}
        {new Date(t.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <Stats t={t} now={now} />
      {s.resumed && <p class="card" data-test="resumed">The app had been closed. Recording carried on when it opened again — the
        part you walked while it was closed is not counted.</p>}
      {stats.gapMs > 0 && <p class="muted small" data-test="track-gaps">{sayDuration(stats.gapMs)} with no position (screen locked or
        app closed): the line is broken there and that part is not counted.</p>}
      {s.problem && <p class="card alert" role="alert">{s.problem}</p>}
      {!s.problem && t.parts.length === 0 && !s.paused && <p class="muted small" data-test="waiting-gps">Waiting for a good GPS position…
        {s.lastAccuracy !== null && ` (the last one was within ${s.lastAccuracy} m; it needs 35 m or better)`}</p>}
      <div class="track-buttons">
        {s.paused
          ? <button type="button" class="small-button primary" onClick={() => void resumeTrack()} data-test="track-resume"><Icon name="trail" size={18} />Carry on</button>
          : <button type="button" class="small-button" onClick={pauseTrack} data-test="track-pause">Pause</button>}
        <button type="button" class="small-button stop" onClick={() => void stop()} data-test="track-stop">Stop and save</button>
      </div>
      <KeepScreenNote s={s} />
      <FindsMap locate trails={trails} here={here} tall />
      {tracks && tracks.length > 0 && (
        <label class="check"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast((e.target as HTMLInputElement).checked)}
          data-test="show-past" />{' '}Show my last {Math.min(PAST_ON_MAP, tracks.length)} walks too</label>
      )}
      {showPast && tracks && <Legend tracks={tracks} />}
      <p class="muted small">You can save a location, scan or read the guide while it records: the walk carries on, and a bar at the top
        of every page brings you back here.</p>
    </>
  );
}

function WalkList({ tracks }: { tracks: Track[] }) {
  return (
    <div class="walk-list" data-test="walk-list">
      {tracks.map((t) => {
        const s = trackStats(t);
        return (
          <a class="walk-line" href={hrefFor({ name: 'track', id: t.id })} key={t.id} data-test="walk-row">
            <span class="walk-line-text"><strong>{t.name}</strong>
              <span class="muted small">{sayDay(t.start)} · {sayKm(s.distanceM)} · {sayDuration(s.timeMs)}{s.high !== null && ` · ↑ ${s.up} m`}</span></span>
            <Icon name="chevron" size={18} />
          </a>
        );
      })}
    </div>
  );
}

export function Tracks() {
  const s = useRecorder();
  const tracks = useTracks();
  const [problem, setProblem] = useState<string | null>(null);
  const start = async () => { try { await startTrack(); } catch { setProblem('The walk could not be started on this phone.'); } };
  return (
    <>
      <BackLink href={hrefFor({ name: 'map' })} label="Map" />
      <h1>Record a walk</h1>
      {s.track ? <Recording s={s} tracks={tracks} /> : (
        <>
          <button type="button" class="choice-button main track-start" onClick={() => void start()} data-test="track-start">
            <span class="choice-icon"><Icon name="trail" size={30} /></span>
            <span class="choice-text"><strong>Start</strong><small>Records your route, the distance and the climb</small></span>
          </button>
          <p class="muted small">The screen stays on while it records: an iPhone gives the app no position while it is locked. It
            works without a signal — it only needs the sky.</p>
          {problem && <p class="card alert" role="alert">{problem}</p>}
        </>
      )}
      {tracks && tracks.length > 0 && !s.track && (
        <>
          <h2>Your last {Math.min(PAST_ON_MAP, tracks.length)} walks</h2>
          <FindsMap trails={pastTrails(tracks)} frameTrails locate />
          <Legend tracks={tracks} />
        </>
      )}
      {tracks && tracks.length > 0 && <h2>All your walks <span class="muted">({tracks.length})</span></h2>}
      {tracks && tracks.length > 0 && <WalkList tracks={tracks} />}
      {tracks && tracks.length === 0 && !s.track && <p class="card">No walks recorded yet. Press Start when you set off, and Stop
        at the end: the walk is kept here under its date, on this phone.</p>}
    </>
  );
}

/** The height along the walk, as a small drawing: distance across, height up. */
function Profile({ t }: { t: Track }) {
  const pts = heightProfile(t);
  if (pts.length < 2) return null;
  const maxD = pts[pts.length - 1][0] || 1;
  const hs = pts.map((p) => p[1]);
  const lo = Math.min(...hs), hi = Math.max(...hs);
  const span = Math.max(10, hi - lo);
  const W = 320, H = 90;
  const xy = pts.map(([d, h]) => `${((d / maxD) * W).toFixed(1)},${(H - ((h - lo) / span) * (H - 8) - 4).toFixed(1)}`);
  return (
    <figure class="track-profile" data-test="track-profile">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,${H} ${xy.join(' ')} ${W},${H}`} fill="#d3f9d8" />
        <polyline points={xy.join(' ')} fill="none" stroke={NOW_COLOUR} stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
      <figcaption class="muted small">Height along the walk: {Math.round(lo)} m to {Math.round(hi)} m above sea level, over {sayKm(maxD)}.</figcaption>
    </figure>
  );
}

export function TrackPage({ id }: { id: string }) {
  const [t, setT] = useState<Track | null | undefined>(undefined);
  const [name, setName] = useState('');
  useEffect(() => { void getTrack(id).then((x) => { setT(x ?? null); setName(x?.name ?? ''); }, () => setT(null)); }, [id]);
  if (t === undefined) return <p class="muted">Loading…</p>;
  if (t === null) return <><BackLink href={hrefFor({ name: 'tracks' })} label="Walks" /><h1>Walk not found</h1><p>It is no longer on this phone.</p></>;
  if (t.end === null) {
    return <><BackLink href={hrefFor({ name: 'tracks' })} label="Walks" /><h1>{t.name}</h1>
      <p class="card">This walk is being recorded. <a href={hrefFor({ name: 'tracks' })}>Open it</a>.</p></>;
  }
  const s = trackStats(t);
  const rename = async () => {
    const next = { ...t, name: name.trim() || t.name };
    await putTrack(next, true);
    setT(next); setName(next.name);
  };
  const remove = async () => {
    if (!confirm('Delete this walk from the phone? This cannot be undone.')) return;
    await deleteTrack(t.id);
    location.hash = hrefFor({ name: 'tracks' });
  };
  return (
    <>
      <BackLink href={hrefFor({ name: 'tracks' })} label="Walks" />
      <h1 data-test="track-title">{t.name}</h1>
      <p class="muted">{sayDay(t.start)}, {new Date(t.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} to{' '}
        {new Date(t.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <Stats t={t} now={Date.parse(t.end)} />
      {s.gapMs > 0 && <p class="muted small" data-test="track-gaps">{sayDuration(s.gapMs)} with no position (screen locked or app closed):
        the line is broken there and that part is not counted.</p>}
      {s.points === 0 ? <p class="card">No position was recorded on this walk.</p>
        : <FindsMap trails={[{ id: t.id, color: NOW_COLOUR, parts: t.parts }]} frameTrails locate tall />}
      <Profile t={t} />
      <div class="card">
        <label class="field-label" for="walk-name">Name</label>
        <input id="walk-name" class="field" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <p><button type="button" class="small-button" onClick={() => void rename()} disabled={name.trim() === t.name || !name.trim()}
          data-test="track-rename">Save the name</button></p>
      </div>
      <p><button type="button" class="small-button danger" onClick={() => void remove()} data-test="track-delete">Delete this walk</button></p>
    </>
  );
}

/** At the top of every other page while a walk is recording: it is still on, how far, and the way back to it. */
export function RecordingBar({ hidden }: { hidden: boolean }) {
  const s = useRecorder();
  const now = useTick(!!s.track && !s.paused);
  if (!s.track || hidden) return null;
  const st = trackStats(s.track, now);
  return (
    <a class="recording-bar" href={hrefFor({ name: 'tracks' })} data-test="recording-bar">
      <span class="rec-dot" />{s.paused ? 'Walk paused' : 'Recording your walk'} · {sayKm(st.distanceM)} · {sayDuration(st.timeMs)}
      <Icon name="chevron" size={16} />
    </a>
  );
}
