-- Exams table to store exam details
CREATE TABLE exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  exam_code VARCHAR(50) UNIQUE NOT NULL,
  duration INTEGER NOT NULL, -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions table to store exam questions
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'multiple-choice', -- e.g., 'multiple-choice', 'text'
  points INTEGER NOT NULL DEFAULT 1,
  correct_answer TEXT NOT NULL, -- Stores correct option ID or text answer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Options table for multiple-choice question options
CREATE TABLE options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  option_id VARCHAR(10) NOT NULL, -- e.g., 'a', 'b', 'c', 'd'
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Exam Sessions table to link students to exams
CREATE TABLE exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active', -- e.g., 'active', 'completed', 'terminated'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Responses table to store student answers
CREATE TABLE responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL, -- Stores selected option_id or text answer
  score INTEGER, -- Calculated score for the question
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert all exams first to satisfy foreign key constraints
INSERT INTO exams (id, title, exam_code, duration)
VALUES 
  ('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'Advanced Computer Science', 'ADV-CS', 7200),
  ('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'Web Development Fundamentals', 'WEB-FUND', 5400),
  ('a9c2e5f7-e29b-41d4-a716-446655440000', 'Database Systems', 'DB-SYS', 6000);

-- Insert questions for Advanced Computer Science exam
INSERT INTO questions (id, exam_id, text, points, correct_answer)
VALUES
  ('a2b3c4d5-6789-0123-4567-89abcdef0123', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'What is the time complexity of quicksort in the worst case?', 2, 'c'),
  ('e5f67890-1234-5678-9012-3456789abcde', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'Which of the following is NOT a React Hook?', 1, 'c'),
  ('i9j0k1l2-3456-7890-1234-56789abcdef0', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'What does the following code output? const arr = [1, 2, 3, 4, 5]; const result = arr.filter(num => num % 2 === 0).map(num => num * 2); console.log(result);', 3, 'b'),
  ('m3n4o5p6-7890-1234-5678-9abcdef01234', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'Which data structure would be most efficient for implementing a priority queue?', 2, 'd'),
  ('q7r8s9t0-1234-5678-9012-3456789abcde', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'What is the output of this Python code? def func(x, y=[]): y.append(x) return y print(func(1)) print(func(2)) print(func(3, []))', 3, 'b'),
  ('6a1b2c3d-4e5f-6789-0123-456789abcdef', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'What is the primary difference between a stack and a queue?', 2, 'b'),
  ('7b2c3d4e-5f67-8901-2345-6789abcdef01', 'e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d', 'Which sorting algorithm is most efficient for nearly sorted data?', 2, 'c');

-- Insert questions for Web Development Fundamentals exam
INSERT INTO questions (id, exam_id, text, points, correct_answer)
VALUES
  ('u1v2w3x4-5678-9012-3456-789abcdef012', 'f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'Which of the following is NOT a valid CSS selector?', 1, 'c'),
  ('y5z6a7b8-9012-3456-7890-123456789abc', 'f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'What is the correct HTML element for the largest heading?', 1, 'b'),
  ('c9d0e1f2-3456-7890-1234-56789abcdef0', 'f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'Which JavaScript method is used to add a new element at the end of an array?', 2, 'a'),
  ('9c3d4e5f-6789-0123-4567-89abcdef0123', 'f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'What does the CSS property "flex" do?', 2, 'b'),
  ('0d4e5f67-8901-2345-6789-abcdef012345', 'f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e', 'Which JavaScript event is triggered when a user clicks an element?', 1, 'b');

-- Insert questions for Database Systems exam
INSERT INTO questions (id, exam_id, text, points, correct_answer)
VALUES
  ('1e5f6789-0123-4567-89ab-cdef01234567', 'a9c2e5f7-e29b-41d4-a716-446655440000', 'What is the purpose of a primary key in a relational database?', 2, 'b'),
  ('2f678901-2345-6789-abcd-ef0123456789', 'a9c2e5f7-e29b-41d4-a716-446655440000', 'Which SQL clause is used to filter grouped results?', 1, 'b');

-- Insert options for question 1 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('a2b3c4d5-6789-0123-4567-89abcdef0123', 'a', 'O(n)'),
  ('a2b3c4d5-6789-0123-4567-89abcdef0123', 'b', 'O(n log n)'),
  ('a2b3c4d5-6789-0123-4567-89abcdef0123', 'c', 'O(n²)'),
  ('a2b3c4d5-6789-0123-4567-89abcdef0123', 'd', 'O(n!)');

-- Insert options for question 2 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('e5f67890-1234-5678-9012-3456789abcde', 'a', 'useEffect'),
  ('e5f67890-1234-5678-9012-3456789abcde', 'b', 'useState'),
  ('e5f67890-1234-5678-9012-3456789abcde', 'c', 'useHistory'),
  ('e5f67890-1234-5678-9012-3456789abcde', 'd', 'useCallback');

-- Insert options for question 3 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('i9j0k1l2-3456-7890-1234-56789abcdef0', 'a', '[2, 4, 6, 8, 10]'),
  ('i9j0k1l2-3456-7890-1234-56789abcdef0', 'b', '[4, 8]'),
  ('i9j0k1l2-3456-7890-1234-56789abcdef0', 'c', '[2, 4]'),
  ('i9j0k1l2-3456-7890-1234-56789abcdef0', 'd', '[1, 3, 5]');

-- Insert options for question 4 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('m3n4o5p6-7890-1234-5678-9abcdef01234', 'a', 'Array'),
  ('m3n4o5p6-7890-1234-5678-9abcdef01234', 'b', 'Linked List'),
  ('m3n4o5p6-7890-1234-5678-9abcdef01234', 'c', 'Binary Search Tree'),
  ('m3n4o5p6-7890-1234-5678-9abcdef01234', 'd', 'Heap');

-- Insert options for question 5 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('q7r8s9t0-1234-5678-9012-3456789abcde', 'a', '[1], [2], [3]'),
  ('q7r8s9t0-1234-5678-9012-3456789abcde', 'b', '[1], [1, 2], [3]'),
  ('q7r8s9t0-1234-5678-9012-3456789abcde', 'c', '[1], [2], [1, 2, 3]'),
  ('q7r8s9t0-1234-5678-9012-3456789abcde', 'd', '[1, 2, 3], [1, 2, 3], [3]');

-- Insert options for question 6 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('6a1b2c3d-4e5f-6789-0123-456789abcdef', 'a', 'Stack is FIFO, Queue is LIFO'),
  ('6a1b2c3d-4e5f-6789-0123-456789abcdef', 'b', 'Stack is LIFO, Queue is FIFO'),
  ('6a1b2c3d-4e5f-6789-0123-456789abcdef', 'c', 'Both are FIFO'),
  ('6a1b2c3d-4e5f-6789-0123-456789abcdef', 'd', 'Both are LIFO');

-- Insert options for question 7 (Advanced Computer Science)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('7b2c3d4e-5f67-8901-2345-6789abcdef01', 'a', 'Bubble Sort'),
  ('7b2c3d4e-5f67-8901-2345-6789abcdef01', 'b', 'Quick Sort'),
  ('7b2c3d4e-5f67-8901-2345-6789abcdef01', 'c', 'Insertion Sort'),
  ('7b2c3d4e-5f67-8901-2345-6789abcdef01', 'd', 'Merge Sort');

-- Insert options for question 8 (Web Development Fundamentals)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('u1v2w3x4-5678-9012-3456-789abcdef012', 'a', '#id'),
  ('u1v2w3x4-5678-9012-3456-789abcdef012', 'b', '.class'),
  ('u1v2w3x4-5678-9012-3456-789abcdef012', 'c', '*element'),
  ('u1v2w3x4-5678-9012-3456-789abcdef012', 'd', '[attribute]');

-- Insert options for question 9 (Web Development Fundamentals)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('y5z6a7b8-9012-3456-7890-123456789abc', 'a', '<heading>'),
  ('y5z6a7b8-9012-3456-7890-123456789abc', 'b', '<h1>'),
  ('y5z6a7b8-9012-3456-7890-123456789abc', 'c', '<head>'),
  ('y5z6a7b8-9012-3456-7890-123456789abc', 'd', '<header>');

-- Insert options for question 10 (Web Development Fundamentals)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('c9d0e1f2-3456-7890-1234-56789abcdef0', 'a', 'push()'),
  ('c9d0e1f2-3456-7890-1234-56789abcdef0', 'b', 'append()'),
  ('c9d0e1f2-3456-7890-1234-56789abcdef0', 'c', 'addToEnd()'),
  ('c9d0e1f2-3456-7890-1234-56789abcdef0', 'd', 'insert()');

-- Insert options for question 11 (Web Development Fundamentals)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('9c3d4e5f-6789-0123-4567-89abcdef0123', 'a', 'Sets the font size'),
  ('9c3d4e5f-6789-0123-4567-89abcdef0123', 'b', 'Enables flexible box layout'),
  ('9c3d4e5f-6789-0123-4567-89abcdef0123', 'c', 'Changes text alignment'),
  ('9c3d4e5f-6789-0123-4567-89abcdef0123', 'd', 'Adjusts margin spacing');

-- Insert options for question 12 (Web Development Fundamentals)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('0d4e5f67-8901-2345-6789-abcdef012345', 'a', 'mouseover'),
  ('0d4e5f67-8901-2345-6789-abcdef012345', 'b', 'click'),
  ('0d4e5f67-8901-2345-6789-abcdef012345', 'c', 'keydown'),
  ('0d4e5f67-8901-2345-6789-abcdef012345', 'd', 'submit');

-- Insert options for question 13 (Database Systems)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('1e5f6789-0123-4567-89ab-cdef01234567', 'a', 'To store duplicate records'),
  ('1e5f6789-0123-4567-89ab-cdef01234567', 'b', 'To uniquely identify each record'),
  ('1e5f6789-0123-4567-89ab-cdef01234567', 'c', 'To link multiple tables'),
  ('1e5f6789-0123-4567-89ab-cdef01234567', 'd', 'To sort the table data');

-- Insert options for question 14 (Database Systems)
INSERT INTO options (question_id, option_id, text)
VALUES
  ('2f678901-2345-6789-abcd-ef0123456789', 'a', 'WHERE'),
  ('2f678901-2345-6789-abcd-ef0123456789', 'b', 'HAVING'),
  ('2f678901-2345-6789-abcd-ef0123456789', 'c', 'GROUP BY'),
  ('2f678901-2345-6789-abcd-ef0123456789', 'd', 'ORDER BY');
