import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/apiClient';
import { useAuth } from '../context/authContextShared';

// Helper mappings
const GOAL_MAP = {
  lose_fat: 'weight_loss',
  gain_muscle: 'muscle_gain',
  recomposition: 'recomposition',
  general_fitness: 'general_fitness',
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Steps
  // 0: Phone
  // 1: Basic Profile
  // 2: Goals/Activity
  // 3: Onboarding Complete
  // 4: App Info (quick)
  // 5: Diet Preferences
  // 6: Workout Setup
  // 7: Sleep/Medical
  // 8: Personalization Complete
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  const [formData, setFormData] = useState({
    phoneNumber: '',
    name: '',
    dob: '',
    sex: '', // male | female | other
    weight: '', // kg
    height: '', // cm (optional)

    primaryGoal: '', // lose_fat | gain_muscle | recomposition | general_fitness
    targetWeight: '', // kg (optional)
    activityLevel: '', // sedentary | lightly_active | moderately_active | very_active
    timeAvailability: '', // morning | evening | flexible

    dietPreference: '', // veg | non_veg | vegan | keto | none
    allergies: '', // free text
    mealFrequency: '', // 3 | 5 | flexible

    workoutSetup: '', // gym | home_minimal | bodyweight
    injury: '', // yes | no
    injuryNotes: '',

    sleepHours: '', // number
    medicalConditions: '', // optional text
  });

  // Prefill phone number from auth
  useEffect(() => {
    if (user?.phoneNumber) {
      setFormData((prev) => ({ ...prev, phoneNumber: user.phoneNumber }));
    }
  }, [user]);

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 8));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const phaseInfo = () => {
    // returns { total, current } for progress dots in current sub-phase
    if (currentStep <= 2) {
      return { total: 3, current: currentStep + 1 };
    }
    if (currentStep >= 5 && currentStep <= 7) {
      return { total: 3, current: currentStep - 4 };
    }
    return null; // no dots on success/info screens
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return !!formData.phoneNumber;
      case 1:
        return !!(formData.name && formData.dob && formData.sex && formData.weight);
      case 2:
        return !!(formData.primaryGoal && formData.activityLevel && formData.timeAvailability);
      case 5:
        return !!(formData.mealFrequency);
      case 6:
        return !!(formData.workoutSetup && formData.injury);
      case 7:
        return !!formData.sleepHours; // medical optional
      default:
        return true;
    }
  };

  // Background plan generation once personalization is complete and success screen is shown
  useEffect(() => {
    const shouldGenerate = currentStep === 8 && !generatedPlan && !isGenerating;
    if (!shouldGenerate) return;
    const generate = async () => {
      setIsGenerating(true);
      try {
        const payload = {
          goal: GOAL_MAP[formData.primaryGoal] || 'general_fitness',
          preferences: {
            targetWeight: formData.targetWeight || undefined,
            activityLevel: formData.activityLevel,
            timeAvailability: formData.timeAvailability,
            dietPreference: formData.dietPreference || 'none',
            allergies: formData.allergies || '',
            mealFrequency: formData.mealFrequency,
            workoutSetup: formData.workoutSetup,
            injury: formData.injury === 'yes',
            injuryNotes: formData.injury === 'yes' ? formData.injuryNotes : '',
            sleepHours: formData.sleepHours,
            medicalConditions: formData.medicalConditions || '',
            userInfo: {
              phoneNumber: formData.phoneNumber,
              name: formData.name,
              dob: formData.dob,
              sex: formData.sex,
              weight: formData.weight,
              height: formData.height,
            },
          },
        };
        const res = await api.post('/plans/generate', payload);
        setGeneratedPlan(res.data);
      } catch (e) {
        console.error('Plan generation failed', e);
      } finally {
        setIsGenerating(false);
      }
    };
    generate();
  }, [currentStep, formData, generatedPlan, isGenerating]);

  const renderHeader = () => {
    const p = phaseInfo();
    return (
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className={`text-secondary-600 hover:text-secondary-800 ${currentStep === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Back"
        >
          ←
        </button>
        {p ? (
          <div className="flex gap-2">
            {Array.from({ length: p.total }).map((_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i + 1 <= p.current ? 'bg-primary-500' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        ) : <div className="h-2" />}
        <div className="w-5" />
      </div>
    );
  };

  const renderScreen = () => {
    // Render per step
    switch (currentStep) {
      case 0:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">What’s your phone number?</h2>
            <p className="text-secondary-600 mb-6">We use it for secure sign-in and to sync your plan across devices.</p>
            <label className="block mb-4">
              <span className="block text-sm text-secondary-700 mb-1">Phone Number</span>
              <input
                type="tel"
                className="w-full border rounded-lg px-4 py-3"
                value={formData.phoneNumber}
                onChange={(e) => setField('phoneNumber', e.target.value)}
                placeholder="+1 555 123 4567"
                disabled={!!user?.phoneNumber}
              />
              {user?.phoneNumber && (
                <span className="text-xs text-secondary-500">From your sign-in. To change, sign out and re-authenticate.</span>
              )}
            </label>
          </>
        );
      case 1:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">Tell us about you 👋</h2>
            <p className="text-secondary-600 mb-6">We’ll personalize your plan with this info.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-secondary-700">Name</span>
                <input type="text" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.name} onChange={(e) => setField('name', e.target.value)} placeholder="Your name" />
              </label>
              <label className="block">
                <span className="text-sm text-secondary-700">Date of Birth</span>
                <input type="date" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.dob} onChange={(e) => setField('dob', e.target.value)} />
              </label>
              <div>
                <span className="text-sm text-secondary-700">Sex</span>
                <div className="mt-2 flex gap-4">
                  {['male','female','other'].map(val => (
                    <label key={val} className="inline-flex items-center gap-2">
                      <input type="radio" name="sex" value={val} checked={formData.sex === val} onChange={(e) => setField('sex', e.target.value)} />
                      <span className="capitalize">{val}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-secondary-700">Weight (kg)</span>
                  <input type="number" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.weight} onChange={(e) => setField('weight', e.target.value)} min="0" step="0.1" />
                </label>
                <label className="block">
                  <span className="text-sm text-secondary-700">Height (cm) <span className="text-xs text-secondary-500">(optional)</span></span>
                  <input type="number" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.height} onChange={(e) => setField('height', e.target.value)} min="0" />
                </label>
              </div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">Your goals and routine 🎯</h2>
            <p className="text-secondary-600 mb-6">We’ll fine-tune training and nutrition to match.</p>
            <div className="space-y-5">
              <div>
                <span className="text-sm text-secondary-700">Primary Goal</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {[
                    { label: 'Lose fat', value: 'lose_fat' },
                    { label: 'Gain muscle', value: 'gain_muscle' },
                    { label: 'Recomposition', value: 'recomposition' },
                    { label: 'General fitness', value: 'general_fitness' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center justify-between border rounded-lg px-4 py-3 cursor-pointer ${formData.primaryGoal === opt.value ? 'border-primary-500' : 'border-gray-200'}`}>
                      <span>{opt.label}</span>
                      <input type="radio" name="primaryGoal" value={opt.value} checked={formData.primaryGoal === opt.value} onChange={(e) => setField('primaryGoal', e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-sm text-secondary-700">Target Weight (kg) <span className="text-xs text-secondary-500">(optional)</span></span>
                <input type="number" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.targetWeight} onChange={(e) => setField('targetWeight', e.target.value)} min="0" step="0.1" />
              </label>
              <div>
                <span className="text-sm text-secondary-700">Activity Level</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {[
                    { label: 'Sedentary', value: 'sedentary' },
                    { label: 'Lightly active', value: 'lightly_active' },
                    { label: 'Moderately active', value: 'moderately_active' },
                    { label: 'Very active', value: 'very_active' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center justify-between border rounded-lg px-4 py-3 cursor-pointer ${formData.activityLevel === opt.value ? 'border-primary-500' : 'border-gray-200'}`}>
                      <span>{opt.label}</span>
                      <input type="radio" name="activityLevel" value={opt.value} checked={formData.activityLevel === opt.value} onChange={(e) => setField('activityLevel', e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm text-secondary-700">Work Schedule / Time Availability</span>
                <div className="mt-2 flex gap-3">
                  {[
                    { label: 'Morning', value: 'morning' },
                    { label: 'Evening', value: 'evening' },
                    { label: 'Flexible', value: 'flexible' },
                  ].map(opt => (
                    <label key={opt.value} className={`px-4 py-2 rounded-full border cursor-pointer ${formData.timeAvailability === opt.value ? 'border-primary-500 text-primary-700' : 'border-gray-300 text-secondary-700'}`}>
                      <input type="radio" name="timeAvailability" className="hidden" value={opt.value} checked={formData.timeAvailability === opt.value} onChange={(e) => setField('timeAvailability', e.target.value)} />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      case 3:
        return (
          <div className="text-center py-10">
            <div className="text-5xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-2xl font-semibold mb-2">Onboarding complete</h2>
            <p className="text-secondary-600">Nice work, {formData.name || 'friend'}! You’re all set.</p>
          </div>
        );
      case 4:
        return (
          <div className="text-center py-6 space-y-6">
            <div className="flex items-center justify-center gap-6 text-4xl">
              <span className="animate-pulse">🤖</span>
              <span className="animate-bounce">🏋️</span>
              <span className="animate-pulse">🥗</span>
            </div>
            <h2 className="text-2xl font-semibold">How this app helps</h2>
            <ul className="text-left text-secondary-700 space-y-2 max-w-sm mx-auto">
              <li>• AI-tailored workouts and meals</li>
              <li>• Adjusts with your routine and goals</li>
              <li>• Simple daily check-ins keep you on track</li>
            </ul>
          </div>
        );
      case 5:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">Let’s tune your nutrition 🥗</h2>
            <p className="text-secondary-600 mb-6">Your diet style helps us design the best meal plan.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-secondary-700">Diet Preference</span>
                <select className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.dietPreference} onChange={(e) => setField('dietPreference', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non-Veg</option>
                  <option value="vegan">Vegan</option>
                  <option value="keto">Keto</option>
                  <option value="none">No preference</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-secondary-700">Food Allergies / Restrictions</span>
                <input type="text" className="mt-1 w-full border rounded-lg px-4 py-3" placeholder="e.g., peanuts, lactose" value={formData.allergies} onChange={(e) => setField('allergies', e.target.value)} />
              </label>
              <div>
                <span className="text-sm text-secondary-700">Meal Frequency Preference</span>
                <div className="mt-2 flex gap-3">
                  {[
                    { label: '3 meals', value: '3' },
                    { label: '5 small meals', value: '5' },
                    { label: 'Flexible', value: 'flexible' },
                  ].map(opt => (
                    <label key={opt.value} className={`px-4 py-2 rounded-full border cursor-pointer ${formData.mealFrequency === opt.value ? 'border-primary-500 text-primary-700' : 'border-gray-300 text-secondary-700'}`}>
                      <input type="radio" name="mealFrequency" className="hidden" value={opt.value} checked={formData.mealFrequency === opt.value} onChange={(e) => setField('mealFrequency', e.target.value)} />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      case 6:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">Workout setup 💪</h2>
            <p className="text-secondary-600 mb-6">We’ll tailor sessions to your environment.</p>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-secondary-700">Where will you train?</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {[
                    { label: 'Gym', value: 'gym' },
                    { label: 'Home (minimal equipment)', value: 'home_minimal' },
                    { label: 'Bodyweight only', value: 'bodyweight' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center justify-between border rounded-lg px-4 py-3 cursor-pointer ${formData.workoutSetup === opt.value ? 'border-primary-500' : 'border-gray-200'}`}>
                      <span>{opt.label}</span>
                      <input type="radio" name="workoutSetup" value={opt.value} checked={formData.workoutSetup === opt.value} onChange={(e) => setField('workoutSetup', e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm text-secondary-700">Injuries / Limitations</span>
                <div className="mt-2 flex gap-3">
                  {['yes','no'].map(val => (
                    <label key={val} className={`px-4 py-2 rounded-full border cursor-pointer ${formData.injury === val ? 'border-primary-500 text-primary-700' : 'border-gray-300 text-secondary-700'}`}>
                      <input type="radio" name="injury" className="hidden" value={val} checked={formData.injury === val} onChange={(e) => setField('injury', e.target.value)} />
                      <span className="capitalize">{val}</span>
                    </label>
                  ))}
                </div>
              </div>
              {formData.injury === 'yes' && (
                <label className="block">
                  <span className="text-sm text-secondary-700">Notes (optional)</span>
                  <textarea className="mt-1 w-full border rounded-lg px-4 py-3" rows={3} value={formData.injuryNotes} onChange={(e) => setField('injuryNotes', e.target.value)} placeholder="e.g., knee pain, shoulder impingement" />
                </label>
              )}
            </div>
          </>
        );
      case 7:
        return (
          <>
            <h2 className="text-2xl font-semibold mb-1">Recovery & health 💤</h2>
            <p className="text-secondary-600 mb-6">Sleep and health info help calibrate intensity.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-secondary-700">Average Sleep Hours</span>
                <input type="number" className="mt-1 w-full border rounded-lg px-4 py-3" value={formData.sleepHours} onChange={(e) => setField('sleepHours', e.target.value)} min="0" max="24" step="0.5" placeholder="e.g., 7.5" />
              </label>
              <label className="block">
                <span className="text-sm text-secondary-700">Medical Conditions <span className="text-xs text-secondary-500">(optional)</span></span>
                <textarea className="mt-1 w-full border rounded-lg px-4 py-3" rows={3} value={formData.medicalConditions} onChange={(e) => setField('medicalConditions', e.target.value)} placeholder="Anything we should consider?" />
              </label>
              <p className="text-xs text-secondary-500">Disclaimer: This app does not provide medical advice. Consult a healthcare professional for medical concerns.</p>
            </div>
          </>
        );
      case 8:
        return (
          <div className="text-center py-10">
            <div className="text-5xl mb-4 animate-bounce">🚀</div>
            <h2 className="text-2xl font-semibold mb-2">Personalization complete</h2>
            <p className="text-secondary-600 mb-2">Awesome, {formData.name || 'friend'}! Your plan is now fully personalized.</p>
            {isGenerating && <p className="text-secondary-500">Preparing your plan…</p>}
            {!isGenerating && generatedPlan && (
              <p className="text-green-600">Your plan is ready.</p>
            )}
            {!isGenerating && !generatedPlan && (
              <p className="text-red-600">We couldn't generate a plan right now. You can start and generate later.</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const primaryCtaText = () => {
    if (currentStep === 3) return 'Continue';
    if (currentStep === 4) return 'Next';
    if (currentStep === 8) return 'Start My Plan';
    if (currentStep <= 2 || (currentStep >= 5 && currentStep <= 7)) return 'Next';
    return 'Continue';
  };

  const onPrimary = async () => {
    if (currentStep === 8) {
      // Navigate to home; plan may have been generated already.
      navigate('/home');
      return;
    }
    goNext();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-primary-700">AI Lifestyle Coach</h1>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          {renderHeader()}
          {renderScreen()}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={currentStep === 0}
              className={`text-secondary-700 px-4 py-2 rounded-lg ${currentStep === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
            >
              Back
            </button>
            <div className="flex items-center gap-4">
              {currentStep === 4 && (
                <button onClick={goNext} className="text-secondary-600 hover:underline">Skip</button>
              )}
              <button
                onClick={onPrimary}
                disabled={!isStepValid()}
                className={`px-5 py-2 rounded-lg text-white ${isStepValid() ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {primaryCtaText()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
