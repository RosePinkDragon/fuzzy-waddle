import { Redirect } from 'expo-router';

/** Unknown paths go home. */
export default function NotFound() {
  return <Redirect href="/" />;
}
