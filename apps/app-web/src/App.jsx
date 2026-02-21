import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobHistory from './pages/JobHistory';
import LargeCap from './pages/LargeCap';
import EodhdUsage from './pages/EodhdUsage';
import HeatMap from './pages/HeatMap';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/history/:jobName" element={<JobHistory />} />
            <Route path="/large-cap" element={<LargeCap />} />
            <Route path="/eodhd-usage" element={<EodhdUsage />} />
            <Route path="/heatmap" element={<HeatMap />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
