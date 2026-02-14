import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';

function App() {
  return (
    // ADD THIS: basename="/demo"
    <Router basename="/demo">
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Placeholder Routes */}
        <Route path="/student" element={<h1>Student Dashboard</h1>} />
        <Route path="/officer" element={<h1>Officer Dashboard</h1>} />
        <Route path="/osa" element={<h1>OSA Dashboard</h1>} />
      </Routes>
    </Router>
  );
}

export default App;