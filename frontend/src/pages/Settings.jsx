import { useAuth } from '../context/authContextShared';

const Settings = () => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-500 text-white px-4 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-primary-100">Customize your experience</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Profile</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Edit Profile</span>
              <button className="text-primary-500 font-medium">Edit</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Change Goals</span>
              <button className="text-primary-500 font-medium">Update</button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Daily Reminders</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle1" defaultChecked className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Workout Reminders</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle2" defaultChecked className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                <label htmlFor="toggle2" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
          </div>
        </div>

        {/* Data Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">Data & Privacy</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Export Data</span>
              <button className="text-primary-500 font-medium">Export</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Privacy Policy</span>
              <button className="text-primary-500 font-medium">View</button>
            </div>
          </div>
        </div>

        {/* App Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-secondary-700 mb-4">App</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Version</span>
              <span className="text-secondary-400">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-600">Help & Support</span>
              <button className="text-primary-500 font-medium">Contact</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-600">Sign Out</span>
              <button onClick={signOut} className="text-red-500 font-medium">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
