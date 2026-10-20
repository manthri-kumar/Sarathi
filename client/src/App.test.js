import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Auth/AuthPage', () => () => <main>Authentication screen</main>);
jest.mock('./pages/Dashboard', () => () => <main>Dashboard screen</main>);
jest.mock('./pages/Explore', () => () => <main>Explore screen</main>);
jest.mock('./pages/Itinerary', () => () => <main>Itinerary screen</main>);
jest.mock('./pages/MyTrips', () => () => <main>My Trips screen</main>);
jest.mock('./pages/Saved', () => () => <main>Saved screen</main>);
jest.mock('./pages/Profile', () => () => <main>Profile screen</main>);
jest.mock('./pages/DayPlanner', () => () => <main>Day Planner screen</main>);
jest.mock('./pages/TripPlanner', () => () => <main>Trip Planner screen</main>);
jest.mock('./pages/TempleExplorer', () => () => <main>Temples screen</main>);
jest.mock('./components/temple/TempleDetailsPage', () => () => (
  <main>Temple details screen</main>
));

const renderAt = (path, token = null) => {
  window.history.pushState({}, '', path);
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
  return render(<App />);
};

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('redirects an unauthenticated protected route to authentication', async () => {
  renderAt('/dashboard');
  expect(await screen.findByText('Authentication screen')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});

test('redirects an authenticated visitor away from authentication', async () => {
  renderAt('/', 'test-token');
  expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/dashboard');
});

test.each([
  ['/dashboard', 'Dashboard screen'],
  ['/explore', 'Explore screen'],
  ['/itinerary', 'Itinerary screen'],
  ['/day-planner', 'Day Planner screen'],
  ['/trip-planner', 'Trip Planner screen'],
  ['/my-trips', 'My Trips screen'],
  ['/saved', 'Saved screen'],
  ['/profile', 'Profile screen'],
  ['/temples', 'Temples screen'],
  ['/temples/example-place-id', 'Temple details screen'],
])('renders the protected %s route for an authenticated user', async (path, label) => {
  renderAt(path, 'test-token');
  expect(await screen.findByText(label)).toBeInTheDocument();
});
