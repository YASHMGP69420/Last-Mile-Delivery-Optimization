import React from 'react';

// Simple static SVG placeholder for route illustration
export const PlaceholderMap: React.FC = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 400 300"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background */}
    <rect width="400" height="300" fill="#f0f4f8" />
    {/* Example route line */}
    <polyline
      points="50,250 100,200 150,150 200,120 250,100 300,80 350,60"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Stops as circles */}
    <circle cx="50" cy="250" r="6" fill="#10b981" />
    <circle cx="100" cy="200" r="6" fill="#10b981" />
    <circle cx="150" cy="150" r="6" fill="#10b981" />
    <circle cx="200" cy="120" r="6" fill="#10b981" />
    <circle cx="250" cy="100" r="6" fill="#10b981" />
    <circle cx="300" cy="80" r="6" fill="#10b981" />
    <circle cx="350" cy="60" r="6" fill="#10b981" />
    {/* Optional label */}
    <text x="200" y="20" textAnchor="middle" fontSize="16" fill="#374151">
      Route Illustration
    </text>
  </svg>
);

export default PlaceholderMap;
