# AI Exam Proctoring Tool

An advanced online exam platform with built-in AI proctoring features. This tool supports student and admin roles, secure authentication, live proctoring, automated scoring, and robust exam management. Built with React, Node.js, and Supabase.

---

## Features

- **Student & Admin Roles**: Separate login and dashboards
- **Exam Codes**: Unique codes for each exam; students must enter code to join
- **AI Proctoring**: Face detection, tab switch, and full-screen monitoring
- **Live Monitoring**: Admins can monitor students in real-time
- **Automated Scoring**: Immediate results after exam completion
- **Secure Authentication**: Passwords securely hashed and stored
- **Database Integration**: All data managed with Supabase

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or above recommended)
- [npm](https://www.npmjs.com/)
- [Supabase account](https://supabase.com/) (for your database)

---

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/utkarshpatil02/NeuroWatchMain
   cd ai-exam-proctoring-tool
   ```

2. **Install dependencies for both frontend and backend:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the root or in `src/server/` with your Supabase credentials:
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_anon_key
     ```

4. **Set up your Supabase database:**
   - Run the SQL scripts provided in the documentation to create tables for students, admins, exams, questions, options, exam_sessions, student_answers, and proctoring_events.
   - Insert sample exam data as needed.

---

### Running the Application

#### Start the Frontend

```bash
npm run dev
```
- This will start the React frontend (usually on [http://localhost:3000](http://localhost:3000)).

#### Start the Backend Server

```bash
cd src/server
nodemon index.js
```
- This will start the Express backend server (usually on [http://localhost:5000](http://localhost:5000)).

---

## Usage

- **Students:**  
  1. Go to `/student-login`
  2. Enter email, password, and the unique exam code provided by the admin
  3. Complete the exam under AI proctoring
  4. Receive instant results after submission

- **Admins:**  
  1. Go to `/admin-login`
  2. Create and manage exams, monitor live sessions, and review student activity

---

## Project Structure

```
ai-exam-proctoring-tool/
│
├── src/
│   ├── components/           # React components (frontend)
│   ├── server/               # Express backend
│   │   └── index.js          # Main backend server file
│   └── ...                   # Other frontend files
├── package.json
└── README.md
```

---

## Customization

- **Add More Exams:**  
  Use the provided SQL structure to add more exams, questions, and options in Supabase.
- **Proctoring Rules:**  
  Modify or extend AI proctoring logic in the frontend and backend as needed.

---

## Troubleshooting

- If you get a "MODULE_NOT_FOUND" error, check your file paths and ensure you are running the correct commands from the project root.
- Ensure your Supabase credentials are correct and the tables are created as per the schema.

---

## License

MIT License

---

## Credits

Powered by React, Node.js, and Supabase

---

**To start the project:**

- Frontend:  
  `npm run dev`
- Backend:  
  `cd src/server`  
  `nodemon index.js`

---
