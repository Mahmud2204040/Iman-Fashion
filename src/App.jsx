import AppRoutes from './routes/AppRoutes.jsx';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { useAuth } from './hooks/useAuth.js';

function App() {
  const location = useLocation();
  const { role } = useAuth();
  const home = role === 'EMPLOYEE' ? '/sales/new' : role === 'OWNER' ? '/dashboard' : '/login';
  return <ErrorBoundary key={location.pathname} home={home}><AppRoutes /></ErrorBoundary>;
}

export default App;
