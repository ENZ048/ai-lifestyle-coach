const PlanCard = ({ plan }) => {
  if (!plan) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-secondary-700 mb-2">Today's Plan</h2>
        <p className="text-secondary-500 text-sm">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      <div className="space-y-4">
        {/* Workout Section */}
        <div className="border-l-4 border-primary-500 pl-4">
          <div className="flex items-center mb-2">
            <span className="text-lg mr-2">💪</span>
            <h3 className="font-semibold text-secondary-700">Workout</h3>
            {plan.workoutCompleted && (
              <span className="ml-auto text-green-500 text-sm font-medium">✓ Completed</span>
            )}
          </div>
          <p className="text-secondary-600">
            {plan.workout || 'No workout scheduled for today'}
          </p>
        </div>

        {/* Meals Section */}
        <div className="border-l-4 border-secondary-500 pl-4">
          <div className="flex items-center mb-2">
            <span className="text-lg mr-2">🍽️</span>
            <h3 className="font-semibold text-secondary-700">Meals</h3>
            {plan.mealsCompleted && (
              <span className="ml-auto text-green-500 text-sm font-medium">✓ Completed</span>
            )}
          </div>
          <div className="text-secondary-600">
            {plan.meals ? (
              typeof plan.meals === 'string' ? (
                <p>{plan.meals}</p>
              ) : (
                <div className="space-y-1">
                  {plan.meals.breakfast && <p><strong>Breakfast:</strong> {plan.meals.breakfast}</p>}
                  {plan.meals.lunch && <p><strong>Lunch:</strong> {plan.meals.lunch}</p>}
                  {plan.meals.dinner && <p><strong>Dinner:</strong> {plan.meals.dinner}</p>}
                  {plan.meals.snacks && <p><strong>Snacks:</strong> {plan.meals.snacks}</p>}
                </div>
              )
            ) : (
              <p>No meal plan available</p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-secondary-700">Daily Progress</span>
            <span className="text-sm text-secondary-500">
              {(plan.workoutCompleted ? 1 : 0) + (plan.mealsCompleted ? 1 : 0)}/2 completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${((plan.workoutCompleted ? 1 : 0) + (plan.mealsCompleted ? 1 : 0)) * 50}%` 
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanCard;
