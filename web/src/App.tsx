import { useState } from 'react';
import { DailyTab } from './components/DailyTab';
import { FreeplayTab } from './components/FreeplayTab';

type Tab = 'daily' | 'freeplay';

export function App() {
  const [tab, setTab] = useState<Tab>('daily');

  return (
    <div className="app">
      <h1 className="app-title">Progressive Anagrams</h1>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'daily'}
          className={`tab-button ${tab === 'daily' ? 'tab-button--active' : ''}`}
          onClick={() => setTab('daily')}
        >
          Daily
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'freeplay'}
          className={`tab-button ${tab === 'freeplay' ? 'tab-button--active' : ''}`}
          onClick={() => setTab('freeplay')}
        >
          Freeplay
        </button>
      </div>

      {tab === 'daily' ? <DailyTab /> : <FreeplayTab />}
    </div>
  );
}
