const CheckInButton = ({ label, icon, completed, onCheckIn }) => {
  return (
    <button
      onClick={onCheckIn}
      disabled={completed}
      className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
        completed
          ? 'border-green-500 bg-green-50 text-green-700 cursor-not-allowed'
          : 'border-primary-500 bg-white text-primary-700 hover:bg-primary-50 active:bg-primary-100'
      }`}
    >
      <div className="flex items-center justify-center space-x-3">
        <span className="text-2xl">{icon}</span>
        <div className="text-left">
          <div className="font-semibold">
            {completed ? `${label} ✓` : label}
          </div>
          <div className="text-sm opacity-75">
            {completed ? 'Completed!' : 'Tap to mark as done'}
          </div>
        </div>
      </div>
    </button>
  );
};

export default CheckInButton;
