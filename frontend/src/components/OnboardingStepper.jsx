const OnboardingStepper = ({ 
  steps, 
  currentStep, 
  formData, 
  onInputChange, 
  onNext, 
  onPrevious, 
  onFinish, 
  isLoading, 
  generatedPlan 
}) => {
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                What's your name?
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => onInputChange('name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Age
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => onInputChange('age', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your age"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => onInputChange('weight', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your weight"
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                What's your primary goal?
              </label>
              <select
                value={formData.goal}
                onChange={(e) => onInputChange('goal', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select your goal</option>
                <option value="weight_loss">Weight Loss</option>
                <option value="muscle_gain">Muscle Gain</option>
                <option value="maintenance">Maintenance</option>
                <option value="general_fitness">General Fitness</option>
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Preferred workout type
              </label>
              <select
                value={formData.preferences.workoutType}
                onChange={(e) => onInputChange('preferences.workoutType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select workout type</option>
                <option value="cardio">Cardio</option>
                <option value="strength">Strength Training</option>
                <option value="yoga">Yoga</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Dietary restrictions
              </label>
              <select
                value={formData.preferences.dietaryRestrictions}
                onChange={(e) => onInputChange('preferences.dietaryRestrictions', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">No restrictions</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="gluten_free">Gluten Free</option>
                <option value="dairy_free">Dairy Free</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Available time per day
              </label>
              <select
                value={formData.preferences.availableTime}
                onChange={(e) => onInputChange('preferences.availableTime', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select time</option>
                <option value="15-30">15-30 minutes</option>
                <option value="30-45">30-45 minutes</option>
                <option value="45-60">45-60 minutes</option>
                <option value="60+">60+ minutes</option>
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-6">
            {isLoading ? (
              <div>
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-secondary-600">Generating your personalized plan...</p>
              </div>
            ) : generatedPlan ? (
              <div className="bg-white rounded-lg p-6 shadow-sm text-left">
                <h3 className="text-lg font-semibold text-secondary-700 mb-4">Your Personalized Plan</h3>
                <div className="space-y-3">
                  {/* Display the plan from backend response */}
                  {generatedPlan.plan && (
                    <>
                      {generatedPlan.plan.title && (
                        <div>
                          <p className="font-medium text-secondary-600">Plan Title:</p>
                          <p className="text-secondary-700">{generatedPlan.plan.title}</p>
                        </div>
                      )}
                      {generatedPlan.plan.daily && generatedPlan.plan.daily.length > 0 && (
                        <div>
                          <p className="font-medium text-secondary-600">Day 1 Preview:</p>
                          <div className="bg-gray-50 p-3 rounded mt-1">
                            <p className="text-sm text-secondary-600">Workout: {generatedPlan.plan.daily[0].workout || 'Custom workout'}</p>
                            <p className="text-sm text-secondary-600">Meals: {Array.isArray(generatedPlan.plan.daily[0].meals) ? generatedPlan.plan.daily[0].meals.join(', ') : generatedPlan.plan.daily[0].meals || 'Personalized meals'}</p>
                            {generatedPlan.plan.daily[0].notes && (
                              <p className="text-sm text-secondary-600">Notes: {generatedPlan.plan.daily[0].notes}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {generatedPlan.plan.raw && (
                        <div>
                          <p className="font-medium text-secondary-600">Plan Summary:</p>
                          <p className="text-secondary-700 text-sm">{generatedPlan.plan.raw}</p>
                        </div>
                      )}
                    </>
                  )}
                  {generatedPlan.saved && (
                    <div className="bg-green-50 p-3 rounded mt-4">
                      <p className="text-green-700 text-sm">✓ Plan saved successfully!</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-red-500">Failed to generate plan. Please try again.</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return formData.name && formData.age && formData.weight;
      case 1:
        return formData.goal;
      case 2:
        return formData.preferences.workoutType && formData.preferences.availableTime;
      case 3:
        return generatedPlan;
      default:
        return true;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-secondary-700 mb-4">
          {steps[currentStep]?.title}
        </h2>
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onPrevious}
          disabled={currentStep === 0}
          className={`px-6 py-2 rounded-lg font-medium ${
            currentStep === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-secondary-700 hover:bg-gray-300'
          }`}
        >
          Previous
        </button>

        {currentStep === steps.length - 1 ? (
          <button
            onClick={onFinish}
            disabled={!isStepValid() || isLoading}
            className={`px-6 py-2 rounded-lg font-medium ${
              !isStepValid() || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            Get Started
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!isStepValid()}
            className={`px-6 py-2 rounded-lg font-medium ${
              !isStepValid()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingStepper;
