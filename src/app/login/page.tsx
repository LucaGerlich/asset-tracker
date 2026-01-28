import LoginForm from "./LoginForm";

export default function LoginPage() {
  const isDemo = process.env.DEMO_MODE === "true";
  
  return <LoginForm isDemo={isDemo} />;
}
