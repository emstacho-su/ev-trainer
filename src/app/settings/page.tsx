'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAnimationPreferences } from '@/app/providers/AnimationProvider';

export default function SettingsPage() {
  const { animationsEnabled, prefersReducedMotion, toggleAnimations } = useAnimationPreferences();
  const [displayName, setDisplayName] = useState('');
  const [theme, setTheme] = useState<'dark' | 'system'>('dark');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('ev-trainer-display-name') ?? '';
    const storedTheme = (localStorage.getItem('ev-trainer-theme') ?? 'dark') as 'dark' | 'system';
    setDisplayName(storedName);
    setTheme(storedTheme);
  }, []);

  function handleSave() {
    localStorage.setItem('ev-trainer-display-name', displayName);
    localStorage.setItem('ev-trainer-theme', theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Display Name */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-200">Profile</h2>
          <div className="bg-gray-900 rounded-lg p-4 space-y-3">
            <label className="block">
              <span className="text-sm text-gray-400">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
            </label>
          </div>
        </section>

        {/* Animations */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-200">Animations</h2>
          <div className="bg-gray-900 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Enable Animations</p>
                <p className="text-xs text-gray-400">Card deals, chip slides, EV reveals</p>
              </div>
              <button
                onClick={toggleAnimations}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  animationsEnabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
                role="switch"
                aria-checked={animationsEnabled}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    animationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {prefersReducedMotion && (
              <p className="text-xs text-yellow-400/80 bg-yellow-400/10 rounded px-3 py-2">
                Your system has reduced motion enabled. Animations are automatically minimized.
              </p>
            )}
          </div>
        </section>

        {/* Theme */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-200">Appearance</h2>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex gap-3">
              {(['dark', 'system'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTheme(opt)}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    theme === opt
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {opt === 'dark' ? 'Dark' : 'System'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-400">Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
