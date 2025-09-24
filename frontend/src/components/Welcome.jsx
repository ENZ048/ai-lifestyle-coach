import { useAuth } from '../context/authContextShared';

export default function Welcome() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Lifestyle Coach! 🎉
          </h1>
          <p className="text-lg text-gray-600">
            {user?.phoneNumber && `Signed in as ${user.phoneNumber}`}
          </p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            What's Next?
          </h2>
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Complete Your Profile</h3>
                <p className="text-sm text-gray-600">Tell us about your fitness goals and preferences</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Get Your Custom Plan</h3>
                <p className="text-sm text-gray-600">AI will create a personalized workout and meal plan</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Start Your Journey</h3>
                <p className="text-sm text-gray-600">Track progress and achieve your fitness goals</p>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          Ready to transform your lifestyle? Let's get started! 💪
        </p>
      </div>
    </div>
  );
}