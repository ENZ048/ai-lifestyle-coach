import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/home', label: 'Home', icon: '🏠' },
    { path: '/progress', label: 'Progress', icon: '📊' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  // Don't show navbar on onboarding or auth pages
  if (location.pathname === '/onboarding' || location.pathname === '/signin') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors duration-200 ${
              location.pathname === item.path
                ? 'text-primary-600 bg-primary-50'
                : 'text-secondary-400 hover:text-secondary-600'
            }`}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
