import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';

function App() {
  return (
    // ADD THIS: basename="/demo"
    <Router basename="/demo">
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Student Dashboard Route */}
        <Route path="/student" element={<StudentDashboard />} />
        
        {/* Placeholder Routes */}
        <Route path="/officer" element={<h1>Officer Dashboard</h1>} />
        <Route path="/osa" element={<h1>OSA Dashboard</h1>} />
      </Routes>
    </Router>
  );
}

export default App;