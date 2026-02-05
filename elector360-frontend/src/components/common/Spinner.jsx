// src/components/common/Spinner.jsx

function Spinner({ fullScreen = false, message = 'Cargando...' }) {
  const content = (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <div className="absolute top-0 left-0 animate-ping rounded-full h-12 w-12 border-2 border-primary-400 opacity-20"></div>
      </div>
      <p className="mt-4 text-gray-600 text-sm font-medium">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-95 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      {content}
    </div>
  );
}

export default Spinner;