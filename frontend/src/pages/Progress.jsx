import { useState, useEffect } from 'react';
import axios from 'axios';

const Progress = () => {
  const [dailyLogs, setDailyLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDailyLogs();
  }, []);

  const fetchDailyLogs = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/logs/daily`);
      setDailyLogs(response.data);
    } catch (error) {
      console.error('Error fetching daily logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCompletionRate = () => {
    if (dailyLogs.length === 0) return 0;
    const totalActivities = dailyLogs.length * 2; // workout + meals
    const completedActivities = dailyLogs.reduce((acc, log) => {
      return acc + (log.workoutCompleted ? 1 : 0) + (log.mealsCompleted ? 1 : 0);
    }, 0);
    return Math.round((completedActivities / totalActivities) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-500 text-white px-4 py-6">
        <h1 className="text-2xl font-bold">Your Progress</h1>
        <p className="text-primary-100">Track your journey</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Overall Stats */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Overall Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-500">{dailyLogs.length}</div>
              <div className="text-sm text-secondary-500">Days Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-500">{getCompletionRate()}%</div>
              <div className="text-sm text-secondary-500">Completion Rate</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Recent Activity</h2>
          {dailyLogs.length > 0 ? (
            <div className="space-y-4">
              {dailyLogs.slice(0, 10).map((log, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-secondary-700">
                      {new Date(log.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm text-secondary-500">
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' })}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      log.workoutCompleted 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      💪
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      log.mealsCompleted 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      🍽️
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-secondary-500">No activity logged yet</p>
              <p className="text-sm text-secondary-400 mt-1">Start tracking your progress!</p>
            </div>
          )}
        </div>

        {/* Progress Chart Placeholder */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Weekly Progress</h2>
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
            <p className="text-secondary-400">Chart coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Progress;
