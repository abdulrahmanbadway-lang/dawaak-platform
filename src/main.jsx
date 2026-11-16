import { createRoot } from 'react-dom/client';
import './styles.css';
import './pro.css';
import App from './App.jsx';
import ErrorBoundary from './errorboundary.jsx';

createRoot(document.getElementById('root')).render(<ErrorBoundary full><App /></ErrorBoundary>);
