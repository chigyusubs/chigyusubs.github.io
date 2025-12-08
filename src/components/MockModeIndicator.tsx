/**
 * UI indicator for mock/demo mode
 *
 * Shows clear visual feedback when using mock data instead of real API
 */

import { isMockMode } from '../lib/mock/MockProvider';

export function MockModeIndicator() {
  if (!isMockMode()) return null;

  const scenarioName = getScenarioName();

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fbbf24',
        color: '#78350f',
        padding: '12px 16px',
        textAlign: 'center',
        fontWeight: 600,
        zIndex: 9999,
        borderBottom: '2px solid #f59e0b',
      }}
    >
      <span style={{ fontSize: '20px', marginRight: '8px' }}>🎭</span>
      DEMO MODE - Using mock data (no real API calls)
      {scenarioName && (
        <span style={{ marginLeft: '12px', fontSize: '14px', opacity: 0.8 }}>
          Scenario: {scenarioName}
        </span>
      )}
      <button
        onClick={disableMockMode}
        style={{
          marginLeft: '16px',
          padding: '4px 12px',
          backgroundColor: '#78350f',
          color: '#fbbf24',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Exit Demo
      </button>
    </div>
  );
}

function getScenarioName(): string {
  if (import.meta.env.VITE_MOCK_SCENARIO) {
    return import.meta.env.VITE_MOCK_SCENARIO;
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('mock_scenario') || 'happy';
  }

  return 'happy';
}

function disableMockMode() {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.delete('mock');
    url.searchParams.delete('mock_scenario');
    window.location.href = url.toString();
  }
}
