import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5173'], 
  credentials: true 
}));

// Supabase setup
const supabase = createClient(
  'https://iixmojvmoakkwfiymcnv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeG1vanZtb2Fra3dmaXltY252Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgyMjY3MSwiZXhwIjoyMDYzMzk4NjcxfQ.iRjpSjK0G3hB460cz4kcaV7vXX5bPe1-plx2kTis8Js'
);

// Session setup
app.use(session({
  secret: 'your_secret',
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
passport.use('student', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
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
      .single();
    
    if (error || !data) {
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

  // Validate exam code
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('exam_code', exam_code)
    .single();

  if (examError || !exam) {
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

    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Error fetching exams' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));