import React from 'react';
import ReactDOM from 'react-dom/client';
import CodeAgentApp from './agent/code/App';
import SettingsApp from './SettingsApp';

// Same bundle serves both windows; main opens the settings window with ?view=settings.
const view = new URLSearchParams(location.search).get('view');
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(view === 'settings' ? <SettingsApp /> : <CodeAgentApp />);
