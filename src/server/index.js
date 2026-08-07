import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Load .env from this directory, not the process working directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
// Screenshots arrive as base64 data URLs, which inflate by ~4/3. The 1 MB
// image cap in decodeScreenshot is the real limit; this just has to clear it.
app.use(express.json({ limit: '2mb' }));
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5173'], 
  credentials: true 
}));

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport strategies
//
// Note the use of maybeSingle() over single(): single() reports "no rows" as an
// error, which makes a missing account indistinguishable from the database
// being unreachable. Treating both as a bad password reports an outage as
// "Invalid email or password" and hides it. maybeSingle() returns data: null
// for no rows, so any error left is a genuine failure and is surfaced as 5xx.
passport.use('student', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return done(error);
    }
    if (!data) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) {
      return done(null, false, { message: 'Invalid email or password' });
    }
    
    return done(null, { id: data.id, role: 'student', email: data.email });
  } catch (error) {
    return done(error);
  }
}));

passport.use('admin', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return done(error);
    }
    if (!data) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) {
      return done(null, false, { message: 'Invalid email or password' });
    }
    
    return done(null, { id: data.id, role: 'admin', email: data.email });
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Auth routes
app.post('/api/signup/student', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const { data: existingUser } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('students')
      .insert([{ email, password: hashedPassword, name }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ 
      success: true, 
      user: { id: data.id, email: data.email, role: 'student' } 
    });
  } catch (error) {
    console.error('Student signup error:', error);
    res.status(500).json({ error: 'Error creating student account' });
  }
});

app.post('/api/signup/admin', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('admins')
      .insert([{ email, password: hashedPassword, name }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ 
      success: true, 
      user: { id: data.id, email: data.email, role: 'admin' } 
    });
  } catch (error) {
    console.error('Admin signup error:', error);
    res.status(500).json({ error: 'Error creating admin account' });
  }
});

app.post('/api/login/student', async (req, res, next) => {
  const { email, password, exam_code } = req.body;

  // Validate exam code. Same reasoning as the strategies above: a lookup
  // failure must not be reported to the student as a bad exam code.
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('exam_code', exam_code)
    .maybeSingle();

  if (examError) {
    return next(examError);
  }
  if (!exam) {
    return res.status(400).json({ error: 'Invalid exam code' });
  }

  passport.authenticate('student', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info.message || 'Authentication failed' });
    }
    req.logIn(user, async (err) => {
      if (err) {
        return next(err);
      }
      // Create exam session
      const session_id = uuidv4();
      const { data: session, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert({
          student_id: user.id,
          exam_id: exam.id,
          session_id,
          status: 'active'
        })
        .select()
        .single();
      
      if (sessionError) {
        return res.status(500).json({ error: 'Error creating exam session' });
      }
      
      return res.json({ 
        success: true, 
        user, 
        exam: { id: exam.id, title: exam.title, duration: exam.duration },
        session_id 
      });
    });
  })(req, res, next);
});

app.post('/api/login/admin', (req, res, next) => {
  passport.authenticate('admin', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info.message || 'Authentication failed' });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.json({ success: true, user });
    });
  })(req, res, next);
});

app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ user: null });
  }
});

// Protected endpoints
app.get('/api/protected/student', (req, res) => {
  if (req.isAuthenticated() && req.user.role === 'student') {
    res.json({ allowed: true });
  } else {
    res.status(401).json({ allowed: false });
  }
});

app.get('/api/protected/admin', (req, res) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    res.json({ allowed: true });
  } else {
    res.status(401).json({ allowed: false });
  }
});

// Fetch exam questions
app.get('/api/exams/:examId/questions', async (req, res) => {
  try {
    const { examId } = req.params;
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId);
    
    if (questionError) throw questionError;

    const questionsWithOptions = await Promise.all(questions.map(async (question) => {
      const { data: options, error: optionError } = await supabase
        .from('options')
        .select('option_id, text')
        .eq('question_id', question.id);
      
      if (optionError) throw optionError;
      
      return { ...question, options };
    }));

    res.json(questionsWithOptions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching exam questions' });
  }
});

// Submit exam responses and calculate score
app.post('/api/exams/:examId/submit', async (req, res) => {
  try {
    const { examId, sessionId, answers } = req.body;
    
    if (!req.isAuthenticated() || req.user.role !== 'student') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the exam session
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    // Update session status
    const { error: updateError } = await supabase
      .from('exam_sessions')
      .update({ status: 'completed', end_time: new Date().toISOString() })
      .eq('id', session.id);
    
    if (updateError) throw updateError;

    // Fetch questions to compare answers
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, correct_answer, points')
      .eq('exam_id', examId);
    
    if (questionError) throw questionError;

    let totalScore = 0;
    const responses = [];

    // Compare answers and calculate score
    for (const question of questions) {
      const studentAnswer = answers[question.id];
      if (studentAnswer) {
        const isCorrect = studentAnswer === question.correct_answer;
        const score = isCorrect ? question.points : 0;
        totalScore += score;
        responses.push({
          session_id: session.id,
          question_id: question.id,
          answer: studentAnswer,
          score
        });
      }
    }

    // Insert responses
    const { error: responseError } = await supabase
      .from('responses')
      .insert(responses);
    
    if (responseError) throw responseError;

    res.json({ success: true, score: totalScore });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ error: 'Error submitting exam' });
  }
});

// Fetch students for a specific exam (for ProctorDashboard)
app.get('/api/exams/:examId/students', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { examId } = req.params;
    const { data: sessions, error: sessionError } = await supabase
      .from('exam_sessions')
      .select(`
        session_id,
        status,
        start_time,
        students (id, name, email)
      `)
      .eq('exam_id', examId);
    
    if (sessionError) throw sessionError;

    // Calculate warnings and progress (assuming warnings are logged elsewhere)
    const students = await Promise.all(sessions.map(async (session) => {
      const { data: responses, error: responseError } = await supabase
        .from('responses')
        .select('question_id')
        .eq('session_id', session.session_id);
      
      if (responseError) throw responseError;

      const { data: questionCount, error: questionCountError } = await supabase
        .from('questions')
        .select('id', { count: 'exact' })
        .eq('exam_id', examId);
      
      if (questionCountError) throw questionCountError;

      const progress = questionCount.length > 0 
        ? Math.round((responses.length / questionCount.length) * 100)
        : 0;

      return {
        id: session.students.id,
        name: session.students.name,
        email: session.students.email,
        status: session.status,
        progress,
        warnings: 0, // Replace with actual warning count if implemented
        lastActivity: session.start_time
      };
    }));

    res.json(students);
  } catch (error) {
    console.error('Error fetching exam students:', error);
    res.status(500).json({ error: 'Error fetching exam students' });
  }
});
app.get('/api/exams', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: exams, error } = await supabase
      .from('exams')
      .select('id, title, exam_code');
    
    if (error) throw error;

    // Wrapped in { data } to match api.js, which reads response.data.data.
    res.json({ data: exams });
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Error fetching exams' });
  }
});

// ✅ NEW: Proctoring Log API
app.post('/api/log-event', async (req, res) => {
  try {
    const { session_id, type } = req.body;

    if (!session_id || !type) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const { error } = await supabase
      .from('proctor_logs')
      .insert([
        {
          session_id,
          event_type: type,
          timestamp: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.error('Log error:', err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// ✅ NEW: Get logs for a session
app.get('/api/logs/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data, error } = await supabase
      .from('proctor_logs')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ---------------------------------------------------------------------------
// Routes consumed by src/services/api.js
//
// Two things to know before editing these.
//
// 1. Session identifiers. exam_sessions has both `id` (uuid primary key) and
//    `session_id` (the value handed to the client at login). The child tables
//    key off different columns: responses.session_id references
//    exam_sessions.id, while proctor_logs.session_id references
//    exam_sessions.session_id. The client only ever holds session_id, so
//    resolve it with loadSession() before touching responses.
//
// 2. Response envelope. api.js reads `response.data.data` on every call, so
//    these routes wrap their payload in { data: ... }.
// ---------------------------------------------------------------------------

// Resolve the client's session_id to the exam_sessions row.
const loadSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('id, session_id, exam_id, student_id, status, start_time, end_time')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) return null;
  return data;
};

// Students may only touch their own session; admins may touch any.
const canAccessSession = (user, session) =>
  user.role === 'admin' || session.student_id === user.id;

const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Start an exam session. The student login route already creates one; this is
// the entry point used by the standalone registration screen.
app.post('/api/exams/sessions', requireAuth, async (req, res) => {
  try {
    const { examId } = req.body;

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration')
      .eq('id', examId)
      .single();

    if (examError || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const session_id = uuidv4();
    const { error: insertError } = await supabase
      .from('exam_sessions')
      .insert({
        student_id: req.user.role === 'student' ? req.user.id : null,
        exam_id: exam.id,
        session_id,
        status: 'active'
      });

    if (insertError) throw insertError;

    // `id` is the session_id string, since that is the handle every other
    // client call passes back.
    res.status(201).json({
      data: {
        id: session_id,
        sessionId: session_id,
        examId: exam.id,
        title: exam.title,
        duration: exam.duration
      }
    });
  } catch (error) {
    console.error('Error starting exam session:', error);
    res.status(500).json({ error: 'Error starting exam session' });
  }
});

// Record an answer. Scored immediately against the question's correct_answer.
app.post('/api/exams/answers', requireAuth, async (req, res) => {
  try {
    const { sessionId, questionId, optionId } = req.body;

    if (!sessionId || !questionId) {
      return res.status(400).json({ error: 'sessionId and questionId are required' });
    }

    const session = await loadSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!canAccessSession(req.user, session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'Session is no longer active' });
    }

    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, correct_answer, points')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const score = optionId === question.correct_answer ? question.points : 0;

    // No unique constraint on (session_id, question_id), so update in place
    // when the student changes their answer rather than upserting.
    const { data: existing } = await supabase
      .from('responses')
      .select('id')
      .eq('session_id', session.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from('responses')
        .update({ answer: optionId, score })
        .eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('responses')
        .insert({
          session_id: session.id,
          question_id: questionId,
          answer: optionId,
          score
        });
      if (insertError) throw insertError;
    }

    // Deliberately does not return `score`, so the client cannot use this
    // endpoint to probe the correct answer mid-exam.
    res.json({ data: { questionId, answer: optionId, saved: true } });
  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({ error: 'Error saving answer' });
  }
});

// Finish a session and total up the score.
app.post('/api/exams/sessions/:sessionId/submit', requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!canAccessSession(req.user, session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error: updateError } = await supabase
      .from('exam_sessions')
      .update({ status: 'completed', end_time: new Date().toISOString() })
      .eq('id', session.id);

    if (updateError) throw updateError;

    const { data: responses, error: responseError } = await supabase
      .from('responses')
      .select('score')
      .eq('session_id', session.id);

    if (responseError) throw responseError;

    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('points')
      .eq('exam_id', session.exam_id);

    if (questionError) throw questionError;

    const score = responses.reduce((sum, r) => sum + (r.score || 0), 0);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    res.json({
      data: {
        sessionId: session.session_id,
        status: 'completed',
        score,
        totalPoints,
        answered: responses.length,
        totalQuestions: questions.length
      }
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ error: 'Error submitting exam' });
  }
});

// Per-question results for a finished session.
app.get('/api/exams/sessions/:sessionId/results', requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!canAccessSession(req.user, session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: responses, error: responseError } = await supabase
      .from('responses')
      .select('question_id, answer, score, questions(text, points, correct_answer)')
      .eq('session_id', session.id);

    if (responseError) throw responseError;

    const score = responses.reduce((sum, r) => sum + (r.score || 0), 0);
    const totalPoints = responses.reduce(
      (sum, r) => sum + (r.questions?.points || 0),
      0
    );

    res.json({
      data: {
        sessionId: session.session_id,
        status: session.status,
        score,
        totalPoints,
        responses: responses.map((r) => ({
          questionId: r.question_id,
          question: r.questions?.text,
          answer: r.answer,
          correctAnswer: r.questions?.correct_answer,
          score: r.score,
          points: r.questions?.points
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Error fetching results' });
  }
});

// Screenshots live in a private bucket; proctor_logs stores only the path.
// Keeping images out of the table keeps row reads cheap and means access is
// granted by short-lived signed URLs rather than by whoever can read the row.
const SCREENSHOT_BUCKET = 'proctor-screenshots';
const SCREENSHOT_MAX_BYTES = 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 300;

// Latched so the "run the migration" warning appears once, not per request.
let warnedMissingScreenshotColumns = false;

// Accepts a data URL from the client and returns a JPEG buffer, or throws with
// a message safe to return to the caller.
const decodeScreenshot = (dataUrl) => {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('screenshot must be a base64 image/jpeg data URL');

  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length) throw new Error('screenshot is empty');
  if (buffer.length > SCREENSHOT_MAX_BYTES) throw new Error('screenshot exceeds 1 MB');

  // JPEG magic number, so a renamed payload of another type is rejected before
  // it reaches storage.
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('screenshot is not a JPEG');

  return buffer;
};

// Record a proctoring event, optionally with a webcam screenshot.
app.post('/api/proctoring/log', requireAuth, async (req, res) => {
  try {
    const { sessionId, eventType, details, screenshot } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ error: 'sessionId and eventType are required' });
    }

    const session = await loadSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!canAccessSession(req.user, session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let screenshotPath = null;
    if (screenshot) {
      let buffer;
      try {
        buffer = decodeScreenshot(screenshot);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      // Namespaced by session so one student's images cannot be guessed from
      // another's, and so a session's images can be removed as a unit.
      const safeType = String(eventType).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
      const path = `${session.session_id}/${Date.now()}-${safeType}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });

      // A storage failure must not lose the event itself: the log is the
      // record that matters, the image is supporting evidence.
      if (uploadError) console.error('Screenshot upload failed:', uploadError.message);
      else screenshotPath = path;
    }

    const base = {
      session_id: session.session_id,
      event_type: eventType,
      timestamp: new Date().toISOString()
    };

    let { error } = await supabase
      .from('proctor_logs')
      .insert({ ...base, screenshot_path: screenshotPath, details: details ?? null });

    // Tolerate running against a database where migrations/001 has not been
    // applied yet: keep recording the event rather than dropping it, and say
    // so once rather than on every request.
    if (error && /screenshot_path|details/.test(error.message ?? '')) {
      if (!warnedMissingScreenshotColumns) {
        warnedMissingScreenshotColumns = true;
        console.warn(
          'proctor_logs is missing screenshot_path/details - run ' +
          'migrations/001_proctor_logs_screenshots.sql. Logging events without them.'
        );
      }

      // The image was uploaded before the insert failed. Nothing will ever
      // reference it now, so remove it rather than accumulate orphans in the
      // bucket on every screenshot event.
      if (screenshotPath) {
        const { error: cleanupError } = await supabase.storage
          .from(SCREENSHOT_BUCKET)
          .remove([screenshotPath]);
        if (cleanupError) {
          console.error('Failed to remove orphaned screenshot:', cleanupError.message);
        }
        screenshotPath = null;
      }

      ({ error } = await supabase.from('proctor_logs').insert(base));
    }

    // Same reasoning if the insert failed for any other reason.
    if (error && screenshotPath) {
      await supabase.storage.from(SCREENSHOT_BUCKET).remove([screenshotPath]).catch(() => {});
    }

    if (error) throw error;

    res.status(201).json({
      data: { logged: true, eventType, screenshotStored: screenshotPath !== null }
    });
  } catch (error) {
    console.error('Error logging proctoring event:', error);
    res.status(500).json({ error: 'Error logging proctoring event' });
  }
});

// Proctoring log for one session.
app.get('/api/proctoring/sessions/:sessionId/logs', requireAuth, async (req, res) => {
  try {
    const session = await loadSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!canAccessSession(req.user, session)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // proctor_logs keys off session_id, not the exam_sessions primary key.
    // select('*') rather than naming columns, so this still works before
    // migrations/001 adds screenshot_path and details.
    const { data, error } = await supabase
      .from('proctor_logs')
      .select('*')
      .eq('session_id', session.session_id)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Mint short-lived signed URLs in one batch. The bucket is private, so
    // these are the only way to view an image, and they expire.
    const paths = data.map((row) => row.screenshot_path).filter(Boolean);
    const urlByPath = {};

    if (paths.length) {
      const { data: signed, error: signError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

      // Losing the URLs must not lose the log itself.
      if (signError) console.error('Signing screenshot URLs failed:', signError.message);
      else signed.forEach((s) => { if (!s.error) urlByPath[s.path] = s.signedUrl; });
    }

    res.json({
      data: data.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        eventType: row.event_type,
        timestamp: row.timestamp,
        details: row.details,
        hasScreenshot: Boolean(row.screenshot_path),
        // Expires in SIGNED_URL_TTL_SECONDS; re-fetch this endpoint for a new one.
        screenshotUrl: row.screenshot_path ? urlByPath[row.screenshot_path] ?? null : null
      }))
    });
  } catch (error) {
    console.error('Error fetching session logs:', error);
    res.status(500).json({ error: 'Error fetching session logs' });
  }
});

// Every session for an exam, with each student's proctoring event count.
app.get('/api/proctoring/exams/:examId/sessions', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: sessions, error } = await supabase
      .from('exam_sessions')
      .select('id, session_id, status, start_time, end_time, students(id, name, email)')
      .eq('exam_id', req.params.examId);

    if (error) throw error;

    const withCounts = await Promise.all(
      sessions.map(async (s) => {
        const { count } = await supabase
          .from('proctor_logs')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', s.session_id);

        return {
          id: s.session_id,
          sessionId: s.session_id,
          status: s.status,
          startTime: s.start_time,
          endTime: s.end_time,
          student: s.students
            ? { id: s.students.id, name: s.students.name, email: s.students.email }
            : null,
          eventCount: count || 0
        };
      })
    );

    res.json({ data: withCounts });
  } catch (error) {
    console.error('Error fetching exam sessions:', error);
    res.status(500).json({ error: 'Error fetching exam sessions' });
  }
});

// One exam with its questions. Students never receive correct_answer.
// Declared after the /api/exams/sessions routes so those match first.
app.get('/api/exams/:examId', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, exam_code, duration')
      .eq('id', req.params.examId)
      .single();

    if (examError || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, text, type, points, correct_answer, options(option_id, text)')
      .eq('exam_id', exam.id);

    if (questionError) throw questionError;

    res.json({
      data: {
        id: exam.id,
        title: exam.title,
        duration: exam.duration,
        examCode: isAdmin ? exam.exam_code : undefined,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          points: q.points,
          options: (q.options || []).map((o) => ({
            id: o.option_id,
            optionId: o.option_id,
            text: o.text
          })),
          ...(isAdmin ? { correctAnswer: q.correct_answer } : {})
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Error fetching exam' });
  }
});

// Error handling middleware
//
// Reaching the database can fail outright (project paused, DNS gone, network
// down). That surfaces as a fetch/network error rather than a database error,
// and it is worth reporting as 503 so an outage is not mistaken for a bug in
// the request.
const isUpstreamUnavailable = (err) => {
  const text = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.cause?.code ?? ''}`;
  return /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ECONNRESET|socket hang up/i.test(text);
};

app.use((err, req, res, next) => {
  console.error(err.stack || err);

  if (isUpstreamUnavailable(err)) {
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }

  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
