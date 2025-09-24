import { useState, useEffect } from 'react';

const PlanGenerationAnimation = ({ onComplete, isGenerating, hasPlan, userInfo }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dots, setDots] = useState('');
  const [completedSteps, setCompletedSteps] = useState(0);

  const steps = [
    { icon: '🧠', text: 'Analyzing your profile', color: 'text-blue-500' },
    { icon: '🎯', text: 'Understanding your goals', color: 'text-purple-500' },
    { icon: '💪', text: 'Designing your workouts', color: 'text-red-500' },
    { icon: '🥗', text: 'Planning your meals', color: 'text-green-500' },
    { icon: '📊', text: 'Optimizing your schedule', color: 'text-orange-500' },
    { icon: '✨', text: 'Finalizing your plan', color: 'text-pink-500' }
  ];

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Progress through steps - but keep cycling if still generating
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = (prev + 1) % steps.length;
        
        // Keep track of completed cycles
        if (nextStep === 0 && prev === steps.length - 1) {
          setCompletedSteps(prevCompleted => prevCompleted + 1);
        }
        
        return nextStep;
      });
    }, 1500); // Slightly faster cycling
    return () => clearInterval(interval);
  }, [steps.length]);

  // Check if we should complete when plan becomes available
  useEffect(() => {
    if (hasPlan && !isGenerating) {
      console.log('Plan ready, animation will complete soon...', { completedSteps, currentStep });
      // Give a small delay to show the final step before completing
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasPlan, isGenerating, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Main Animation Circle */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto relative">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            
            {/* Inner pulsing circle */}
            <div className="absolute inset-4 bg-white rounded-full shadow-lg flex items-center justify-center animate-pulse">
              <span className={`text-4xl ${steps[currentStep]?.color || 'text-blue-500'} transition-colors duration-500`}>
                {steps[currentStep]?.icon || '🧠'}
              </span>
            </div>
            
            {/* Floating particles */}
            <div className="absolute -inset-8">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-ping`}
                  style={{
                    top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 40}%`,
                    left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 40}%`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: '2s'
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Step Info */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Creating Your Perfect Plan
          </h2>
          <p className={`text-lg font-medium ${steps[currentStep]?.color || 'text-blue-500'} transition-colors duration-500`}>
            {steps[currentStep]?.text || 'Getting started'}{dots}
          </p>
          {hasPlan && !isGenerating && (
            <p className="text-sm text-green-600 mt-2 animate-pulse">
              ✓ Plan ready! Finishing up...
            </p>
          )}
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                index <= currentStep 
                  ? 'bg-white shadow-md transform scale-105' 
                  : 'bg-white/50'
              }`}
            >
              <span className={`text-xl ${index <= currentStep ? step.color : 'text-gray-400'} transition-colors duration-500`}>
                {step.icon}
              </span>
              <span className={`font-medium ${index <= currentStep ? 'text-gray-800' : 'text-gray-500'} transition-colors duration-500`}>
                {step.text}
              </span>
              {index <= currentStep && (
                <div className="ml-auto">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* User Info Preview */}
        {userInfo && (
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 text-sm text-gray-600">
            <p>Personalizing for <span className="font-semibold text-gray-800">{userInfo.name}</span></p>
            <p>Goal: <span className="font-semibold text-gray-800">{userInfo.primaryGoal?.replace('_', ' ')}</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanGenerationAnimation;