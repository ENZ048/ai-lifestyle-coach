import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PlanDisplay = ({ plan, userInfo }) => {
  const navigate = useNavigate();
  const [activeDay, setActiveDay] = useState(0);

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No plan available</h2>
          <button 
            onClick={() => navigate('/home')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const days = plan.daily || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎉 Your Personalized Plan is Ready!</h1>
              <p className="text-gray-600 mt-1">
                Crafted specially for {userInfo?.name} • {days.length} days
              </p>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Journey
            </button>
          </div>
        </div>
      </div>

      {/* Plan Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Day Selector */}
        <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => setActiveDay(index)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg font-medium transition-all ${
                activeDay === index
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <div className="text-center">
                <div className="text-sm">{day.day || `Day ${index + 1}`}</div>
                <div className="text-xs opacity-75">{day.focus?.split(' - ')[1] || 'Training'}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Active Day Content */}
        {days[activeDay] && (
          <div className="space-y-6 animate-fadeIn">
            {/* Day Overview */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {days[activeDay].day || `Day ${activeDay + 1}`}
              </h2>
              {days[activeDay].description && (
                <p className="text-gray-600">{days[activeDay].description}</p>
              )}
            </div>

            {/* Workout Section */}
            {days[activeDay].workout && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">💪</span>
                  <h3 className="text-lg font-semibold text-gray-800">Workout</h3>
                </div>
                <div className="space-y-4">
                  {typeof days[activeDay].workout === 'object' && days[activeDay].workout.exercises?.length > 0 ? (
                    days[activeDay].workout.exercises.map((exercise, idx) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="font-medium text-gray-800">{exercise.name}</div>
                        <div className="text-sm text-gray-600">
                          {exercise.sets && `${exercise.sets} sets`}
                          {exercise.reps && ` × ${exercise.reps} reps`}
                          {exercise.duration && ` • ${exercise.duration}`}
                          {exercise.rest && ` • Rest: ${exercise.rest}`}
                        </div>
                        {exercise.notes && (
                          <div className="text-xs text-gray-500 mt-1">{exercise.notes}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-gray-700 leading-relaxed">
                        {typeof days[activeDay].workout === 'string' 
                          ? days[activeDay].workout 
                          : (days[activeDay].workout.description || 'Workout details')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meals Section */}
            {days[activeDay].meals && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">🍽️</span>
                  <h3 className="text-lg font-semibold text-gray-800">Meals</h3>
                </div>
                <div className="space-y-4">
                  {/* Handle array of meals from backend */}
                  {Array.isArray(days[activeDay].meals) ? (
                    days[activeDay].meals.map((meal, idx) => {
                      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
                      return (
                        <div key={idx} className="border rounded-lg p-4">
                          <h4 className="font-medium text-gray-800 mb-2">
                            {mealTypes[idx] || `Meal ${idx + 1}`}
                          </h4>
                          <div className="text-sm text-gray-600">{meal}</div>
                        </div>
                      );
                    })
                  ) : (
                    /* Handle object structure for meals */
                    <div className="grid md:grid-cols-3 gap-4">
                      {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                        const meal = days[activeDay].meals[mealType];
                        return meal ? (
                          <div key={mealType} className="border rounded-lg p-4">
                            <h4 className="font-medium text-gray-800 capitalize mb-2">{mealType}</h4>
                            <div className="text-sm text-gray-600">
                              {typeof meal === 'string' ? meal : meal.description || 'Meal plan'}
                            </div>
                            {meal.calories && (
                              <div className="text-xs text-blue-600 mt-2">~{meal.calories} cal</div>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                  {/* Show snacks if they exist in object structure */}
                  {!Array.isArray(days[activeDay].meals) && days[activeDay].meals.snacks && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-700 mb-1">Snacks</h4>
                      <div className="text-sm text-gray-600">{days[activeDay].meals.snacks}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {days[activeDay].notes && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">📝</span>
                  <h3 className="text-lg font-semibold text-gray-800">Daily Notes</h3>
                </div>
                <p className="text-gray-700">{days[activeDay].notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-8">
          <button
            onClick={() => navigate('/home')}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start My Plan
          </button>
          <button
            onClick={() => window.print()}
            className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Print Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanDisplay;