import React from 'react';
import ReactDOM from 'react-dom/client';
import { domAnimation, LazyMotion } from 'motion/react';
import CodeAgentApp from './agent/code/App';
import SettingsApp from './SettingsApp';

// Same bundle serves both windows; main opens the settings window with ?view=settings.
const view = new URLSearchParams(location.search).get('view');
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <LazyMotion features={domAnimation} strict>
    {view === 'settings' ? <SettingsApp /> : <CodeAgentApp />}
  </LazyMotion>,
);
