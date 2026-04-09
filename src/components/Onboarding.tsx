'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ANIM, EASE } from '@/lib/ui/animationTiming';

const STORAGE_KEY = 'ev-trainer-onboarding-complete';

interface OnboardingStep {
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to EV Trainer',
    description:
      'Practice poker decisions and get instant solver feedback. Each hand tests you against GTO strategy — the mathematically optimal way to play.',
  },
  {
    title: 'How EV Grading Works',
    description:
      'After each decision, the solver reveals the optimal action frequencies and EV (expected value). Green means you chose a solver-approved line. Off-line plays show how much EV you left on the table.',
  },
  {
    title: 'Action Buttons',
    description:
      'Click an action to make your decision. After the reveal, the frequency bar shows how often the solver recommends that action. Higher frequency = stronger play.',
  },
  {
    title: 'Track Your Progress',
    description:
      'Visit Stats to see your accuracy over time, weakest positions, and most costly mistakes. Use Drill suggestions to target your leaks.',
  },
];

/**
 * First-visit onboarding walkthrough.
 * Shows a modal with step-by-step tips.
 * Completion flag stored in localStorage.
 */
export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay opening slightly so the page renders first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsOpen(false);
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIM.MODAL_OPEN, ease: EASE.OUT }}
        >
          <motion.div
            className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full mx-4 p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: ANIM.MODAL_OPEN, ease: EASE.OUT }}
          >
            {/* Step indicator */}
            <div className="flex gap-1.5 mb-5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, ease: EASE.OUT }}
              >
                <h2 className="text-xl font-bold text-white mb-3">
                  {STEPS[step].title}
                </h2>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {STEPS[step].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
              >
                {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
