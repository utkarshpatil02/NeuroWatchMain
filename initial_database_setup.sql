-- Students table
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admins table
CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
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

INSERT INTO questions (exam_id, text, points, correct_answer)
VALUES
-- Advanced CS
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','What is the time complexity of quicksort in the worst case?',2,'c'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','Which of the following is NOT a React Hook?',1,'c'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','What does the following code output? const arr = [1,2,3,4,5]; const result = arr.filter(num => num % 2 === 0).map(num => num * 2); console.log(result);',3,'b'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','Which data structure would be most efficient for implementing a priority queue?',2,'d'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','What is the output of this Python code? def func(x, y=[]): y.append(x) return y print(func(1)) print(func(2)) print(func(3, []))',3,'b'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','What is the primary difference between a stack and a queue?',2,'b'),
('e5a7b3c1-d9f8-4e6a-b2c5-1d3f7a9e8b6d','Which sorting algorithm is most efficient for nearly sorted data?',2,'c'),

-- Web Dev
('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e','Which of the following is NOT a valid CSS selector?',1,'c'),
('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e','What is the correct HTML element for the largest heading?',1,'b'),
('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e','Which JavaScript method is used to add a new element at the end of an array?',2,'a'),
('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e','What does the CSS property "flex" do?',2,'b'),
('f6b8c4d2-e0a1-5b7c-3d9e-2f4a6b8c0d1e','Which JavaScript event is triggered when a user clicks an element?',1,'b'),

-- DB
('a9c2e5f7-e29b-41d4-a716-446655440000','What is the purpose of a primary key in a relational database?',2,'b'),
('a9c2e5f7-e29b-41d4-a716-446655440000','Which SQL clause is used to filter grouped results?',1,'b');

-- Q1
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','O(n)' FROM questions WHERE text LIKE 'What is the time complexity%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','O(n log n)' FROM questions WHERE text LIKE 'What is the time complexity%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','O(n²)' FROM questions WHERE text LIKE 'What is the time complexity%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','O(n!)' FROM questions WHERE text LIKE 'What is the time complexity%';

-- Q2
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','useEffect' FROM questions WHERE text LIKE 'Which of the following is NOT a React Hook%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','useState' FROM questions WHERE text LIKE 'Which of the following is NOT a React Hook%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','useHistory' FROM questions WHERE text LIKE 'Which of the following is NOT a React Hook%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','useCallback' FROM questions WHERE text LIKE 'Which of the following is NOT a React Hook%';

-- Q3
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','[2, 4, 6, 8, 10]' FROM questions WHERE text LIKE 'What does the following code output%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','[4, 8]' FROM questions WHERE text LIKE 'What does the following code output%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','[2, 4]' FROM questions WHERE text LIKE 'What does the following code output%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','[1, 3, 5]' FROM questions WHERE text LIKE 'What does the following code output%';

-- Q4
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','Array' FROM questions WHERE text LIKE 'Which data structure would be most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','Linked List' FROM questions WHERE text LIKE 'Which data structure would be most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','Binary Search Tree' FROM questions WHERE text LIKE 'Which data structure would be most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','Heap' FROM questions WHERE text LIKE 'Which data structure would be most efficient%';

-- Q5
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','[1], [2], [3]' FROM questions WHERE text LIKE 'What is the output of this Python code%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','[1], [1, 2], [3]' FROM questions WHERE text LIKE 'What is the output of this Python code%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','[1], [2], [1, 2, 3]' FROM questions WHERE text LIKE 'What is the output of this Python code%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','[1, 2, 3], [1, 2, 3], [3]' FROM questions WHERE text LIKE 'What is the output of this Python code%';

-- Q6
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','Stack is FIFO, Queue is LIFO' FROM questions WHERE text LIKE 'What is the primary difference%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','Stack is LIFO, Queue is FIFO' FROM questions WHERE text LIKE 'What is the primary difference%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','Both are FIFO' FROM questions WHERE text LIKE 'What is the primary difference%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','Both are LIFO' FROM questions WHERE text LIKE 'What is the primary difference%';

-- Q7
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','Bubble Sort' FROM questions WHERE text LIKE 'Which sorting algorithm is most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','Quick Sort' FROM questions WHERE text LIKE 'Which sorting algorithm is most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','Insertion Sort' FROM questions WHERE text LIKE 'Which sorting algorithm is most efficient%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','Merge Sort' FROM questions WHERE text LIKE 'Which sorting algorithm is most efficient%';

-- Q8
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','#id' FROM questions WHERE text LIKE 'Which of the following is NOT a valid CSS selector%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','.class' FROM questions WHERE text LIKE 'Which of the following is NOT a valid CSS selector%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','*element' FROM questions WHERE text LIKE 'Which of the following is NOT a valid CSS selector%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','[attribute]' FROM questions WHERE text LIKE 'Which of the following is NOT a valid CSS selector%';

-- Q9
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','<heading>' FROM questions WHERE text LIKE 'What is the correct HTML element%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','<h1>' FROM questions WHERE text LIKE 'What is the correct HTML element%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','<head>' FROM questions WHERE text LIKE 'What is the correct HTML element%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','<header>' FROM questions WHERE text LIKE 'What is the correct HTML element%';

-- Q10
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','push()' FROM questions WHERE text LIKE 'Which JavaScript method is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','append()' FROM questions WHERE text LIKE 'Which JavaScript method is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','addToEnd()' FROM questions WHERE text LIKE 'Which JavaScript method is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','insert()' FROM questions WHERE text LIKE 'Which JavaScript method is used%';

-- Q11
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','Sets the font size' FROM questions WHERE text LIKE 'What does the CSS property%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','Enables flexible box layout' FROM questions WHERE text LIKE 'What does the CSS property%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','Changes text alignment' FROM questions WHERE text LIKE 'What does the CSS property%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','Adjusts margin spacing' FROM questions WHERE text LIKE 'What does the CSS property%';

-- Q12
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','mouseover' FROM questions WHERE text LIKE 'Which JavaScript event is triggered%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','click' FROM questions WHERE text LIKE 'Which JavaScript event is triggered%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','keydown' FROM questions WHERE text LIKE 'Which JavaScript event is triggered%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','submit' FROM questions WHERE text LIKE 'Which JavaScript event is triggered%';

-- Q13
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','To store duplicate records' FROM questions WHERE text LIKE 'What is the purpose of a primary key%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','To uniquely identify each record' FROM questions WHERE text LIKE 'What is the purpose of a primary key%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','To link multiple tables' FROM questions WHERE text LIKE 'What is the purpose of a primary key%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','To sort the table data' FROM questions WHERE text LIKE 'What is the purpose of a primary key%';

-- Q14
INSERT INTO options (question_id, option_id, text)
SELECT id,'a','WHERE' FROM questions WHERE text LIKE 'Which SQL clause is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'b','HAVING' FROM questions WHERE text LIKE 'Which SQL clause is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'c','GROUP BY' FROM questions WHERE text LIKE 'Which SQL clause is used%';
INSERT INTO options (question_id, option_id, text)
SELECT id,'d','ORDER BY' FROM questions WHERE text LIKE 'Which SQL clause is used%';