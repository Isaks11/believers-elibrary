import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LogIn, UserPlus, Ghost, Mail, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { AppIcon } from "@/components/common/AppIcon";

export function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!isLogin && !name)) {
      toast.error("Please fill in all fields");
      return;
    }
    login(name || email.split("@")[0], false);
    toast.success(`Welcome ${isLogin ? "back" : ""}!`);
    navigate("/dashboard");
  };

  const handleGuest = () => {
    login("Guest", true);
    toast.success("Welcome! You are browsing as a guest.");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/splash-screen-b8278544-1782601932220.webp')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <Card className="w-full max-w-sm relative z-10 border-none bg-white/90 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <AppIcon className="h-20 w-20 shadow-lg shadow-primary/10" />
          </div>
          <CardTitle className="text-3xl font-serif text-primary">
            Believers Library
          </CardTitle>
          <CardDescription className="text-muted-foreground italic">
            Grow spiritually every day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Input
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/50 border-primary/20"
                />
              </div>
            )}
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/50 border-primary/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLogin ? (
                <LogIn className="mr-2 w-4 h-4" />
              ) : (
                <UserPlus className="mr-2 w-4 h-4" />
              )}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/90 px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full border-primary/20">
              <Mail className="mr-2 w-4 h-4" /> Google
            </Button>
            <Button variant="outline" className="w-full border-primary/20">
              <Users className="mr-2 w-4 h-4 text-blue-600" /> Facebook
            </Button>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              variant="secondary"
              onClick={handleGuest}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Ghost className="mr-2 w-4 h-4" /> Continue as Guest
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-semibold hover:underline"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
