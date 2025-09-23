import { useState, useEffect } from 'react';
import axios from 'axios';
import PlanCard from '../components/PlanCard';
import CheckInButton from '../components/CheckInButton';

const Home = () => {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/plans/current`);
      setCurrentPlan(response.data);
    } catch (error) {
      console.error('Error fetching current plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (type) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/logs/checkin`, {
        type,
        date: new Date().toISOString().split('T')[0]
      });
      
      // Refresh current plan to update check-in status
      fetchCurrentPlan();
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Failed to check in. Please try again.');
    }
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
        <h1 className="text-2xl font-bold">Today's Plan</h1>
        <p className="text-primary-100">{new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {currentPlan ? (
          <>
            <PlanCard plan={currentPlan} />
            
            <div className="space-y-4">
              <CheckInButton
                type="workout"
                label="Complete Workout"
                icon="💪"
                completed={currentPlan.workoutCompleted}
                onCheckIn={() => handleCheckIn('workout')}
              />
              
              <CheckInButton
                type="meals"
                label="Log Meals"
                icon="🍽️"
                completed={currentPlan.mealsCompleted}
                onCheckIn={() => handleCheckIn('meals')}
              />
            </div>

            {currentPlan.notes && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-secondary-700 mb-2">Notes for Today</h3>
                <p className="text-secondary-600">{currentPlan.notes}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-secondary-500 text-lg">No plan available for today</p>
            <p className="text-secondary-400 mt-2">Check back tomorrow or contact support</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
