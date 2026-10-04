import T from '../components/common/LocalizedText.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function NotFoundPage() {
  const { role } = useAuth();
  const home = role === 'EMPLOYEE' ? '/sales/new' : role === 'OWNER' ? '/dashboard' : '/login';
  return (
    <main style={{ maxWidth: 560, margin: '12vh auto', padding: 24 }}>
      <p style={{ color: '#ad783e', fontWeight: 700 }}><T>404 · NI Fashion</T></p>
      <h1><T>Page not found</T></h1>
      <p><T>This address does not match a page in the shop application.</T></p>
      <Link to={home}><T>Return to </T>{role === 'EMPLOYEE' ? 'New Sale' : role === 'OWNER' ? 'Dashboard' : 'Login'}</Link>
    </main>
  );
}
