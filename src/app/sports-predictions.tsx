import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { fanSections, getFanSection, type FanSection } from '@/constants/fan-sections';
import { shareText } from '@/lib/share';
import { bostonDate, bostonGameTime, bostonShortDate, formatCountdown } from '@/lib/dates';
import { getFanId } from '@/lib/fan-session';
import { recordResult } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, Card, Choice, type ChoiceState, FadeIn, Notice, PressableScale, ProgressBar, Row, Screen, Tag, useSection } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

/* ================================================================ shared */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [intervalMs]);
  return now;
}

function Matchup({ away, home, detail }: { away: string; home: string; detail: string }) {
  return (
    <View style={styles.matchup}>
      <Text style={type.title}>{away}</Text>
      <Text style={[type.eyebrow, styles.at]}>at</Text>
      <Text style={type.title}>{home}</Text>
      <Text style={[type.small, styles.matchupDetail]}>{detail}</Text>
    </View>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={[styles.skeletonLine, { width: `${90 - i * 18}%` }]} />
      ))}
    </View>
  );
}

/* ================================================================ Celtics (live backend) */

type UpcomingGame = {
  id: number;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  tipoffBoston: string;
};
type CelticsPick = 'over' | 'under';
type CelticsQuestion = {
  question_id: string;
  question: string;
  threshold: number;
  scoring_type?: 'combined_points' | 'celtics_points' | 'celtics_margin';
};
type CelticsAnswer = CelticsQuestion & {
  choice: CelticsPick | null;
  actual: number | null;
  correct_choice: CelticsPick | 'push' | null;
};
type CelticsResult = {
  game_id: number | string;
  starts_at: string;
  home_score: number;
  away_score: number;
  home_team_name: string | null;
  away_team_name: string | null;
  questions: CelticsAnswer[];
};

const questionLabels: Record<NonNullable<CelticsQuestion['scoring_type']>, string> = {
  combined_points: 'Total points',
  celtics_points: 'Celtics points',
  celtics_margin: 'Celtics margin',
};

function CelticsQuestions({ gameId, closed }: { gameId: number; closed: boolean }) {
  const [questions, setQuestions] = useState<CelticsQuestion[]>();
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadQuestions() {
      try {
        const { data, error } = await supabase.from('celtics_prediction_questions')
          .select('question_id,question,threshold,scoring_type')
          .eq('game_id', gameId).order('question_id');
        if (error) throw error;
        if ((data ?? []).some((row) => typeof row.question !== 'string'
          || row.threshold === null || !Number.isFinite(Number(row.threshold)))) {
          throw new Error('Invalid question');
        }
        if (active) setQuestions((data ?? []).map((row) => ({
          ...row, threshold: Number(row.threshold),
        })) as CelticsQuestion[]);
      } catch {
        if (active) setErrorMessage('Could not load the questions.');
      }
    }
    void loadQuestions();
    return () => { active = false; };
  }, [gameId, retry]);

  if (!questions) {
    return errorMessage ? (
      <View style={styles.stack}>
        <Text style={type.muted}>{errorMessage}</Text>
        <Button label="Retry questions" variant="secondary" onPress={() => { setErrorMessage(''); setRetry((v) => v + 1); }} />
      </View>
    ) : <Skeleton />;
  }
  return <PredictionQuestions key={gameId} gameId={gameId} closed={closed} questions={questions} />;
}

function PredictionQuestions({ gameId, closed, questions }: {
  gameId: number | string; closed: boolean; questions: CelticsQuestion[];
}) {
  const [saved, setSaved] = useState<Record<string, CelticsPick>>({});
  const onSaved = useCallback((id: string, pick: CelticsPick) => setSaved((current) => ({ ...current, [id]: pick })), []);
  const count = Object.keys(saved).length;
  return (
    <View style={styles.stack}>
      {questions.length === 0 ? <Text style={type.muted}>Questions will be available soon.</Text> : (
        <View style={styles.stack}>
          <Row style={styles.between}>
            <Text style={type.eyebrow}>{count} of {questions.length} picks saved</Text>
            {count === questions.length && <Tag label="Slate complete" tone="success" />}
          </Row>
          <ProgressBar value={questions.length ? count / questions.length : 0} />
        </View>
      )}
      {questions.map((question) => (
        <PredictionQuestionPick key={`${gameId}:${question.question_id}`}
          gameId={gameId} closed={closed} question={question} onSaved={onSaved} />
      ))}
    </View>
  );
}

function PredictionQuestionPick({ gameId, closed: deadlinePassed, question, onSaved }: {
  gameId: number | string; closed: boolean; question: CelticsQuestion; onSaved: (id: string, pick: CelticsPick) => void;
}) {
  const [pick, setPick] = useState<CelticsPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<CelticsPick | null>(null);
  const [serverClosed, setServerClosed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('');
  const saveInProgress = useRef(false);
  const closed = deadlinePassed || serverClosed;
  const disabled = closed || loading || !!saving || loadError;

  useEffect(() => {
    let active = true;
    async function loadPick() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) return;
        const table = typeof gameId === 'number' ? 'celtics_prediction_picks' : 'team_prediction_picks';
        const { data, error: pickError } = await supabase.from(table)
          .select('choice').eq('game_id', gameId).eq('user_id', session.user.id)
          .eq('question_id', question.question_id).maybeSingle();
        if (pickError) throw pickError;
        if (active && (data?.choice === 'over' || data?.choice === 'under')) {
          setPick(data.choice);
          onSaved(question.question_id, data.choice);
        }
      } catch {
        if (active) { setLoadError(true); setMessage('Could not load your saved pick.'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPick();
    return () => { active = false; };
  }, [gameId, onSaved, question.question_id, retry]);

  async function savePick(choice: CelticsPick) {
    if (disabled || saveInProgress.current || choice === pick) return;
    saveInProgress.current = true;
    setSaving(choice);
    setMessage('');
    try {
      const userId = await getFanId();
      const { error } = typeof gameId === 'number'
        ? await supabase.from('celtics_prediction_picks').upsert({
          game_id: gameId, user_id: userId, question_id: question.question_id, choice,
        }, { onConflict: 'game_id,user_id,question_id' })
        : await supabase.rpc('save_team_prediction_pick', {
          p_game_id: gameId, p_question_id: question.question_id, p_choice: choice,
        });
      if (error?.message === 'Picks are closed for this game') {
        setServerClosed(true);
        haptic.warning();
        setMessage('The deadline passed. This change was not saved.');
        return;
      }
      if (error) throw error;
      setPick(choice);
      onSaved(question.question_id, choice);
      haptic.success();
      setMessage('Pick saved');
    } catch {
      haptic.error();
      setMessage('Could not save your pick. Try again.');
    } finally {
      saveInProgress.current = false;
      setSaving(null);
    }
  }

  const status = loading ? 'Checking…' : saving ? 'Saving…' : closed ? (pick ? 'Locked' : 'Closed') : message || (pick ? 'Pick saved' : 'Pick one');

  return (
    <Card style={styles.questionCard}>
      <Row style={styles.between}>
        <Text style={type.eyebrow}>{question.scoring_type ? questionLabels[question.scoring_type] : 'Over / Under'}</Text>
        <Text accessibilityLiveRegion="polite" style={[type.small, status === 'Pick saved' && { color: palette.success },
          message && message !== 'Pick saved' && { color: palette.danger }]}>{status}</Text>
      </Row>
      <Text style={type.heading}>{question.question}</Text>
      <Row gap={space.sm}>
        {(['over', 'under'] as const).map((choice) => (
          <OverUnder key={choice} choice={choice} threshold={question.threshold}
            selected={pick === choice} pending={saving === choice} disabled={disabled}
            label={`${question.question} ${choice} ${question.threshold}`}
            onPress={() => void savePick(choice)} />
        ))}
      </Row>
      {loadError && (
        <Button label="Retry saved pick" variant="secondary" onPress={() => {
          setLoadError(false); setLoading(true); setMessage(''); setRetry((v) => v + 1);
        }} />
      )}
    </Card>
  );
}

function OverUnder({ choice, threshold, selected, pending, disabled, label, onPress }: {
  choice: CelticsPick; threshold: number; selected: boolean; pending: boolean; disabled: boolean; label: string; onPress: () => void;
}) {
  const section = useSection();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} feedback="select"
      style={[styles.ou, selected && { backgroundColor: section.accent, borderColor: section.accent },
        pending && { borderColor: section.accent }, disabled && !selected && styles.dim]}>
      <Text style={[styles.ouLabel, selected && { color: palette.dark }]}>{choice === 'over' ? '▲ Over' : '▼ Under'}</Text>
      <Text style={[styles.ouValue, selected && { color: palette.dark }]}>{threshold}</Text>
    </PressableScale>
  );
}

function CelticsNextGame() {
  const [schedule, setSchedule] = useState<{ game: UpcomingGame | null; error: boolean }>();
  const [retry, setRetry] = useState(0);
  const now = useNow();

  useEffect(() => {
    let active = true;
    async function loadSchedule() {
      try {
        const { data, error } = await supabase.functions.invoke<{ games: UpcomingGame[] }>('test-celtics-schedule', { method: 'GET' });
        if (error || !data || !Array.isArray(data.games)) throw new Error('Could not load Celtics schedule');
        if (active) setSchedule({ game: data.games[0] ?? null, error: false });
      } catch {
        if (active) setSchedule({ game: null, error: true });
      }
    }
    void loadSchedule();
    return () => { active = false; };
  }, [retry]);

  const game = schedule?.game;
  const deadline = game ? Date.parse(game.startsAt) : NaN;
  const closed = !Number.isFinite(deadline) || now >= deadline;

  return (
    <Card tone="raised" style={styles.hero}>
      <Row style={styles.between}>
        <Text style={type.eyebrow}>Next game</Text>
        {game && <Tag label={closed ? 'Picks locked' : `Locks in ${formatCountdown(deadline - now)}`} tone={closed ? 'danger' : 'accent'} />}
      </Row>
      {game ? (
        <>
          <Matchup away={game.awayTeam} home={game.homeTeam} detail={`${game.tipoffBoston} Boston time`} />
          <CelticsQuestions key={game.id} gameId={game.id} closed={closed} />
          <Text style={type.small}>Change picks any time before tipoff. No wagering — just bragging rights.</Text>
        </>
      ) : !schedule ? <Skeleton /> : (
        <View style={styles.stack}>
          <Text style={type.muted}>{schedule.error ? 'Couldn’t load the Celtics schedule.' : 'No Celtics games in the next seven days.'}</Text>
          {schedule.error && <Button label="Try again" variant="secondary" onPress={() => { setSchedule(undefined); setRetry((v) => v + 1); }} />}
        </View>
      )}
    </Card>
  );
}

function CelticsLatestResult() {
  const [refresh, setRefresh] = useState(0);
  const [game, setGame] = useState<CelticsResult | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadResult() {
      try {
        const { data, error } = await supabase.rpc('latest_completed_celtics_answers');
        if (error) throw error;
        if (data && (!Array.isArray(data.questions)
          || !Number.isInteger(data.home_score) || !Number.isInteger(data.away_score))) {
          throw new Error('Invalid result');
        }
        if (active) {
          setGame(data as CelticsResult | null);
          setMessage(data ? '' : 'No completed game results yet.');
        }
      } catch {
        if (active) { setGame(null); setMessage('Could not load the result. Try refreshing.'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadResult();
    return () => { active = false; };
  }, [refresh]);

  return <LatestResult game={game} section={fanSections[0]} message={message} loading={loading}
    onRefresh={() => { setLoading(true); setMessage(''); setRefresh((v) => v + 1); }} />;
}

function LatestResult({ game, section, message, loading, onRefresh }: {
  game: CelticsResult | null; section: FanSection; message: string; loading: boolean; onRefresh: () => void;
}) {
  const answered = game?.questions.filter((q) => q.choice !== null) ?? [];
  const graded = answered.filter((q) => q.correct_choice === 'over' || q.correct_choice === 'under');
  const correct = graded.filter((q) => q.choice === q.correct_choice).length;

  useEffect(() => {
    if (!game || graded.length === 0) return;
    recordResult({
      id: `predictions:${section.id}:${game.game_id}`, game: 'predictions', section: section.id,
      date: bostonDate(new Date(game.starts_at)), score: correct * 100, max: graded.length * 100,
      practice: false, summary: `${correct}/${graded.length} picks correct`,
    });
  }, [correct, game, graded.length, section.id]);

  const home = game?.home_team_name?.includes(section.name) ?? false;
  const margin = game ? (home ? game.home_score - game.away_score : game.away_score - game.home_score) : 0;

  return (
    <Card style={styles.hero}>
      <Row style={styles.between}>
        <Text style={type.eyebrow}>Latest result</Text>
        {game && graded.length > 0 && <Tag label={`${correct}/${graded.length} correct`} tone={correct === graded.length ? 'success' : correct === 0 ? 'danger' : 'gold'} />}
      </Row>
      {loading && !game ? <Skeleton /> : game ? (
        <>
          <View style={styles.scoreboard}>
            <View style={styles.scoreTeam}>
              <Text style={type.small} numberOfLines={1}>{game.away_team_name ?? 'Away'}</Text>
              <Text style={styles.scoreValue}>{game.away_score}</Text>
            </View>
            <View style={styles.scoreMid}>
              <Text style={type.eyebrow}>Final</Text>
              <Text style={type.small}>{bostonShortDate.format(new Date(game.starts_at))}</Text>
            </View>
            <View style={[styles.scoreTeam, styles.alignEnd]}>
              <Text style={type.small} numberOfLines={1}>{game.home_team_name ?? 'Home'}</Text>
              <Text style={styles.scoreValue}>{game.home_score}</Text>
            </View>
          </View>
          {game.home_team_name && game.away_team_name && (
            <Text style={[type.small, { color: margin > 0 ? palette.success : margin < 0 ? palette.danger : palette.textMuted }]}>
              {margin === 0 ? 'Tie game' : `${section.name} ${margin > 0 ? 'win' : 'loss'}`}
            </Text>
          )}
          {game.questions.map((q) => {
            const pickLabel = q.choice === null ? 'No pick' : `${q.choice === 'over' ? 'Over' : 'Under'} ${q.threshold}`;
            const gradedPick = q.choice !== null && (q.correct_choice === 'over' || q.correct_choice === 'under');
            const won = gradedPick && q.choice === q.correct_choice;
            return (
              <View key={q.question_id} style={styles.resultRow}>
                <Text style={[styles.resultMark, { color: !gradedPick ? palette.textFaint : won ? palette.success : palette.danger }]}>
                  {q.correct_choice === 'push' ? '=' : !gradedPick ? '–' : won ? '✓' : '✕'}
                </Text>
                <View style={styles.flex}>
                  <Text style={type.body}>{q.question}</Text>
                  <Text style={type.small}>
                    You: {pickLabel}
                    {q.actual !== null ? ` · Actual ${q.actual}` : ''}
                    {q.correct_choice === 'push' ? ' · Push' : q.correct_choice === null ? ' · Awaiting grading' : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          <Text style={type.small}>{correct} of {graded.length} graded picks correct · pushes and missed picks don’t count.</Text>
        </>
      ) : null}
      {!!message && <Text style={type.muted} accessibilityLiveRegion="polite">{message}</Text>}
      <Button label="Refresh result" variant="secondary" loading={loading && !!game} disabled={loading}
        onPress={onRefresh} />
    </Card>
  );
}

type LiveGame = Omit<CelticsResult, 'game_id' | 'home_score' | 'away_score'> & {
  game_id: string;
  closes_at: string;
};
type LiveSlate = {
  active: boolean;
  upcoming: LiveGame | null;
  latest: (LiveGame & { home_score: number; away_score: number }) | null;
};

function useLiveSlate(team: string | undefined) {
  const [slate, setSlate] = useState<LiveSlate | null>();
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!team) return;
    let active = true;
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await supabase.rpc('team_prediction_slate', { p_team: team });
        if (!active) return;
        if (error?.code === 'PGRST202') {
          setSlate(null);
          setFailed(false);
          return;
        }
        if (error || typeof data?.active !== 'boolean') throw new Error('Could not load predictions');
        setSlate(data.active ? data as LiveSlate : null);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      } finally {
        loading = false;
      }
    }
    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 60_000);
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [team, refresh]);

  return { slate, failed, reload: () => setRefresh((value) => value + 1) };
}

/* ================================================================ Patriots / Bruins schedule */

type TeamScheduleGame = Pick<UpcomingGame, 'homeTeam' | 'awayTeam' | 'startsAt'>;

function TeamNextGame({ team, name }: { team: 'patriots' | 'bruins'; name: string }) {
  const [schedule, setSchedule] = useState<{ game: TeamScheduleGame | null; error?: boolean }>();
  const now = useNow(30_000);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.functions.invoke<{ game: TeamScheduleGame | null }>(
          `team-prediction-schedule?team=${team}`, { method: 'GET' },
        );
        if (error || !data || (data.game !== null &&
            (!data.game?.homeTeam || !data.game.awayTeam || !Number.isFinite(Date.parse(data.game.startsAt))))) {
          throw new Error('Invalid schedule response.');
        }
        if (active) setSchedule(data);
      } catch {
        if (active) setSchedule({ game: null, error: true });
      }
    }
    void load();
    return () => { active = false; };
  }, [team]);

  const game = schedule?.game;
  return (
    <Card tone="raised" style={styles.hero}>
      <Row style={styles.between}>
        <Text style={type.eyebrow}>Next game</Text>
        <Tag label="Live picks soon" tone="gold" />
      </Row>
      {game ? (
        <Matchup away={game.awayTeam} home={game.homeTeam}
          detail={`${bostonGameTime.format(new Date(game.startsAt))} · in ${formatCountdown(Date.parse(game.startsAt) - now)}`} />
      ) : !schedule ? <Skeleton lines={2} /> : (
        <Text style={type.muted}>{schedule.error ? 'Schedule unavailable right now.' : `No ${name} games in the next seven days.`}</Text>
      )}
    </Card>
  );
}

function SharedPredictions({ section, slate, refresh }: { section: FanSection; slate: LiveSlate; refresh: () => void }) {
  const now = useNow();
  const game = slate.upcoming;
  const deadline = game ? Date.parse(game.closes_at) : NaN;
  return (
    <>
      <Card tone="raised" style={styles.hero}>
        <Row style={styles.between}>
          <Text style={type.eyebrow}>Next game</Text>
          <Tag label={game && now >= deadline ? 'Picks closed' : 'Live predictions'} tone="gold" />
        </Row>
        {game ? (
          <>
            <Matchup away={game.away_team_name ?? 'Away'} home={game.home_team_name ?? 'Home'}
              detail={bostonGameTime.format(new Date(game.starts_at))} />
            <PredictionQuestions key={game.game_id} gameId={game.game_id}
              closed={!Number.isFinite(deadline) || now >= deadline} questions={game.questions} />
          </>
        ) : <Text style={type.muted}>No upcoming picks are published yet.</Text>}
      </Card>
      {slate.latest || section.id !== 'celtics' ? (
        <LatestResult game={slate.latest} section={section}
          message={slate.latest ? '' : 'No completed game results yet.'} loading={false} onRefresh={refresh} />
      ) : <CelticsLatestResult />}
    </>
  );
}

/* ================================================================ practice slate */

type Prediction = {
  id: string;
  team: string;
  category: string;
  question: string;
  choices: [string, string];
  correctIndex: number;
  simulatedResult: string;
};

// Entirely fictional examples for testing the interface, not scheduled games,
// real player projections, betting lines, or actual results.
const allPredictions: Prediction[] = [
  { id: 'patriots-spread', team: 'Patriots', category: 'Point spread · Patriots -6.5', question: 'Will the Patriots beat the Jets by 7 or more points?',
    choices: ['Yes · win by 7 or more', 'No · win by 6 or fewer, tie, or lose'], correctIndex: 0,
    simulatedResult: 'Simulated final: Patriots 24, Jets 17. New England wins by 7 and covers -6.5.' },
  { id: 'patriots-total', team: 'Patriots', category: 'Total points', question: 'Will Patriots–Jets finish with at least 42 combined points?',
    choices: ['Yes · 42 or more', 'No · 41 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Patriots 24, Jets 17. Combined points: 41.' },
  { id: 'patriots-passing', team: 'Patriots', category: 'Passing yards', question: 'Will the Patriots quarterback throw for at least 225 yards?',
    choices: ['Yes · 225 or more', 'No · 224 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: the Patriots quarterback throws for 238 yards.' },
  { id: 'patriots-rushing', team: 'Patriots', category: 'Rushing yards', question: 'Will the Patriots lead running back rush for at least 70 yards?',
    choices: ['Yes · 70 or more', 'No · 69 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: the lead running back rushes for 76 yards.' },
  { id: 'patriots-sacks', team: 'Patriots', category: 'Team sacks', question: 'Will the Patriots defense record at least 3 sacks?',
    choices: ['Yes · 3 or more', 'No · 2 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: New England records 2 sacks.' },
  { id: 'celtics-spread', team: 'Celtics', category: 'Point spread · Celtics -5.5', question: 'Will the Celtics beat the Knicks by 6 or more points?',
    choices: ['Yes · win by 6 or more', 'No · win by 5 or fewer, or lose'], correctIndex: 0, simulatedResult: 'Simulated: Celtics 112, Knicks 105. Boston wins by 7.' },
  { id: 'celtics-total', team: 'Celtics', category: 'Total points', question: 'Will Celtics–Knicks finish with at least 220 combined points?',
    choices: ['Yes · 220 or more', 'No · 219 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Celtics 112, Knicks 105. Combined points: 217.' },
  { id: 'celtics-player-points', team: 'Celtics', category: 'Player points', question: 'Will Jayson Tatum score at least 28 points?',
    choices: ['Yes · 28 or more', 'No · 27 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: Tatum scores 31 points.' },
  { id: 'celtics-player-assists', team: 'Celtics', category: 'Player assists', question: 'Will Jayson Tatum have more than 4 assists?',
    choices: ['Yes · 5 or more assists', 'No · 4 or fewer assists'], correctIndex: 0, simulatedResult: 'Simulated: Tatum records 6 assists.' },
  { id: 'celtics-player-rebounds', team: 'Celtics', category: 'Player rebounds', question: 'Will Jayson Tatum grab at least 8 rebounds?',
    choices: ['Yes · 8 or more', 'No · 7 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Tatum grabs 7 rebounds.' },
  { id: 'bruins-puck-line', team: 'Bruins', category: 'Puck line · Bruins -1.5', question: 'Will the Bruins beat the Canadiens by 2 or more goals?',
    choices: ['Yes · win by 2 or more', 'No · win by 1 or lose'], correctIndex: 1, simulatedResult: 'Simulated: Bruins 3, Canadiens 2. Boston wins by 1.' },
  { id: 'bruins-total', team: 'Bruins', category: 'Total goals', question: 'Will Bruins–Canadiens finish with at least 6 combined goals?',
    choices: ['Yes · 6 or more', 'No · 5 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Bruins 3, Canadiens 2. Combined goals: 5.' },
  { id: 'bruins-mcavoy-points', team: 'Bruins', category: 'Player points · goals + assists', question: 'Will Charlie McAvoy record at least 2 points?',
    choices: ['Yes · 2 or more points', 'No · 0 or 1 point'], correctIndex: 1, simulatedResult: 'Simulated: McAvoy has 0 goals and 1 assist.' },
  { id: 'bruins-saves', team: 'Bruins', category: 'Goalie saves', question: 'Will Boston’s starting goalie make at least 28 saves?',
    choices: ['Yes · 28 or more', 'No · 27 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: Boston’s starting goalie makes 30 saves.' },
  { id: 'bruins-shots', team: 'Bruins', category: 'Shots on goal', question: 'Will Charlie McAvoy have at least 3 shots on goal?',
    choices: ['Yes · 3 or more', 'No · 2 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: McAvoy records 4 shots on goal.' },
  // Red Sox examples are kept for the team's return after the MVP.
  { id: 'red-sox-run-line', team: 'Red Sox', category: 'Run line · Red Sox -1.5', question: 'Will the Red Sox beat the Yankees by 2 or more runs?',
    choices: ['Yes · win by 2 or more runs', 'No · win by 1 run or lose'], correctIndex: 1, simulatedResult: 'Simulated: Yankees 5, Red Sox 3.' },
  { id: 'red-sox-total', team: 'Red Sox', category: 'Total runs', question: 'Will Red Sox–Yankees finish with at least 9 combined runs?',
    choices: ['Yes · 9 or more', 'No · 8 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Yankees 5, Red Sox 3. Combined runs: 8.' },
  { id: 'red-sox-strikeouts', team: 'Red Sox', category: 'Pitcher strikeouts', question: 'Will Boston’s starting pitcher strike out at least 6 batters?',
    choices: ['Yes · 6 or more', 'No · 5 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: Boston’s starter strikes out 7.' },
  { id: 'red-sox-hits', team: 'Red Sox', category: 'Team hits', question: 'Will the Red Sox collect at least 8 hits?',
    choices: ['Yes · 8 or more', 'No · 7 or fewer'], correctIndex: 0, simulatedResult: 'Simulated: Boston collects 9 hits.' },
  { id: 'red-sox-home-runs', team: 'Red Sox', category: 'Team home runs', question: 'Will the Red Sox hit at least 2 home runs?',
    choices: ['Yes · 2 or more', 'No · 1 or fewer'], correctIndex: 1, simulatedResult: 'Simulated: Boston hits 1 home run.' },
];

const POINTS_PER_PICK = 100;
type Stage = 'picking' | 'locked' | 'settled';
type Picks = Record<string, number>;
type State = { picks: Picks; stage: Stage };
type Action = { type: 'pick'; id: string; choice: number } | { type: 'lock' } | { type: 'settle' } | { type: 'reset' };
const initialState: State = { picks: {}, stage: 'picking' };

function completePicks(picks: Picks, predictions: Prediction[]) {
  return predictions.every((item) => Number.isInteger(picks[item.id]) && picks[item.id] >= 0 && picks[item.id] < item.choices.length);
}

function predictionReducer(state: State, action: Action, predictions: Prediction[]): State {
  if (action.type === 'reset') return initialState;
  if (action.type === 'pick') {
    const item = predictions.find((entry) => entry.id === action.id);
    if (state.stage !== 'picking' || !item || !Number.isInteger(action.choice)
      || action.choice < 0 || action.choice >= item.choices.length) return state;
    return { ...state, picks: { ...state.picks, [action.id]: action.choice } };
  }
  if (action.type === 'lock') {
    return state.stage === 'picking' && completePicks(state.picks, predictions) ? { ...state, stage: 'locked' } : state;
  }
  return state.stage === 'locked' ? { ...state, stage: 'settled' } : state;
}

function PracticeSlate({ predictions, categoryName }: { predictions: Prediction[]; categoryName: string }) {
  const [state, dispatch] = useReducer((current: State, action: Action) => predictionReducer(current, action, predictions), initialState);
  const [shareError, setShareError] = useState('');
  const pickCount = predictions.length;
  const selectedCount = predictions.filter((item) => state.picks[item.id] !== undefined).length;
  const ready = completePicks(state.picks, predictions);
  const settled = state.stage === 'settled';
  const correct = predictions.filter((item) => state.picks[item.id] === item.correctIndex).length;
  const points = correct * POINTS_PER_PICK;

  async function sharePicks() {
    try {
      setShareError('');
      const grid = predictions.map((item) => state.picks[item.id] === item.correctIndex ? '🟩' : '🟥').join('');
      await shareText(`Stadium Pulse · ${categoryName} practice picks\n` +
          (settled ? `${correct}/${pickCount} ${grid}\n` : 'My practice picks are locked.\n') +
          'Fictional matchups. Think you can beat my picks?');
    } catch {
      setShareError('Sharing could not open. Please try again.');
    }
  }

  return (
    <View style={styles.stack}>
      <Row style={styles.between}>
        <Text style={type.title}>Practice slate</Text>
        <Tag label={settled ? `${points} pts` : `${selectedCount}/${pickCount}`} tone="accent" />
      </Row>
      <Notice title="Fictional matchups">
        Sample questions with invented results to learn the format. 100 practice points per correct pick. No money, no wagers.
      </Notice>
      {predictions.map((item, i) => {
        const selected = state.picks[item.id];
        return (
          <FadeIn key={item.id} delay={Math.min(i, 6) * 40}>
            <Card style={styles.questionCard}>
              <Text style={type.eyebrow}>{item.category}</Text>
              <Text style={type.heading}>{item.question}</Text>
              {item.choices.map((choice, index) => {
                let choiceState: ChoiceState = selected === index ? 'selected' : 'idle';
                if (settled) {
                  if (index === item.correctIndex) choiceState = selected === index ? 'correct' : 'reveal';
                  else choiceState = selected === index ? 'incorrect' : 'dimmed';
                }
                return (
                  <Choice key={choice} label={choice} state={choiceState} disabled={state.stage !== 'picking'}
                    accessibilityLabel={`${item.question} ${choice}`}
                    onPress={() => dispatch({ type: 'pick', id: item.id, choice: index })} />
                );
              })}
              {settled && <Text style={type.small}>{item.simulatedResult}</Text>}
            </Card>
          </FadeIn>
        );
      })}

      {state.stage === 'picking' && (
        <Button label={ready ? `Lock all ${pickCount} picks` : `${pickCount - selectedCount} picks to go`} disabled={!ready}
          feedback="heavy" onPress={() => dispatch({ type: 'lock' })} />
      )}
      {state.stage === 'locked' && (
        <Button label="Simulate results" icon="▶" onPress={() => {
          dispatch({ type: 'settle' });
          if (correct >= pickCount / 2) haptic.success(); else haptic.warning();
        }} />
      )}
      {settled && (
        <FadeIn>
          <Card tone="raised" style={styles.center}>
            <Text style={type.eyebrow}>Practice score</Text>
            <Text style={styles.big}>{points}<Text style={styles.bigOf}>/{pickCount * POINTS_PER_PICK}</Text></Text>
            <Text style={type.muted}>{correct} of {pickCount} correct</Text>
          </Card>
        </FadeIn>
      )}
      {state.stage !== 'picking' && <Button label={settled ? 'Share your result' : 'Share your picks'} icon="↗" variant="secondary" onPress={sharePicks} />}
      {settled && <Button label="Reset practice slate" variant="ghost" onPress={() => dispatch({ type: 'reset' })} />}
      {!!shareError && <Text style={type.small}>{shareError}</Text>}
    </View>
  );
}

/* ================================================================ screen */

export default function SportsPredictionsScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(params.sport);
  if (params.sport !== undefined && (!section || section.id === 'boston')) {
    return <Redirect href="/" />;
  }
  return <PredictionsScreen key={section?.id ?? 'all'} section={section} />;
}

function PredictionsScreen({ section }: { section?: FanSection }) {
  const theme = section ?? fanSections[0];
  const predictions = section
    ? allPredictions.filter((item) => item.team === section.name)
    : allPredictions.filter((item) => fanSections.some(({ name }) => name === item.team));
  const isCeltics = section?.id === 'celtics';
  const { slate, failed, reload } = useLiveSlate(section?.id);
  const legacy = !section || slate === null;

  return (
    <Screen
      section={theme}
      back={section ? { pathname: '/fan-challenges', params: { sport: section.id } } : '/'}
      backLabel="Back to challenges"
      eyebrow={`${section?.name ?? 'Boston sports'} · Game predictions`}
      title="Make your picks"
      subtitle={isCeltics ? 'Call the next game’s numbers. See how you did after the final buzzer.' : undefined}
    >
      {section && slate && <SharedPredictions section={section} slate={slate} refresh={reload} />}
      {section && slate === undefined && !failed && <Skeleton />}
      {failed && <Button label="Could not refresh predictions. Tap to retry." variant="secondary" onPress={reload} />}
      {legacy && isCeltics && <CelticsNextGame />}
      {legacy && isCeltics && <CelticsLatestResult />}
      {legacy && (section?.id === 'patriots' || section?.id === 'bruins') && <TeamNextGame team={section.id} name={section.name} />}
      {legacy && !isCeltics && <PracticeSlate predictions={predictions} categoryName={section?.name ?? 'Boston sports'} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  alignEnd: { alignItems: 'flex-end' },
  center: { alignItems: 'center', paddingVertical: space.xl },
  hero: { gap: space.lg },
  matchup: { gap: 2 },
  at: { marginVertical: 2 },
  matchupDetail: { marginTop: space.sm },
  questionCard: { gap: space.md },
  ou: {
    flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: 1.5, borderColor: palette.border,
    backgroundColor: palette.overlay, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  ouLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  ouValue: { color: palette.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.45 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scoreTeam: { flex: 1, gap: 2 },
  scoreMid: { alignItems: 'center', gap: 2 },
  scoreValue: { ...type.number, fontSize: 40, lineHeight: 46 },
  resultRow: { flexDirection: 'row', gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  resultMark: { fontSize: 20, fontWeight: '900', width: 22, textAlign: 'center' },
  skeleton: { gap: 10, paddingVertical: space.sm },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: palette.overlayStrong },
  big: { ...type.number, fontSize: 60, lineHeight: 66 },
  bigOf: { fontSize: 24, color: palette.textMuted },
});
