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
    <div className="sticky top-0 left-0 right-0 bg-amber-400 text-amber-900 px-4 py-3 text-center font-semibold z-[9999] border-b-2 border-amber-500">
      <span className="text-xl mr-2">🎭</span>
      DEMO MODE - Using mock data (no real API calls)
      {scenarioName && (
        <span className="ml-3 text-sm opacity-80">
          Scenario: {scenarioName}
        </span>
      )}
      <button
        onClick={disableMockMode}
        className="ml-4 px-3 py-1 bg-amber-900 text-amber-100 rounded cursor-pointer text-sm"
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
